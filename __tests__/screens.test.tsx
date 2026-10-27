// Render tests: the real screens, the real SDK hooks and components, the in-app demo underneath.
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import App from '../App';
import { AppContext } from '../src/appContext';
import type { ActingAs } from '../src/backend/types';
import { AppConsentProvider } from '../src/consent/AppConsentProvider';
import { startConsentSession } from '../src/consent/startSession';
import { inAppDemoBackend } from '../src/demo/demoBackend';
import { ConsentCheckScreen } from '../src/screens/ConsentCheckScreen';
import { ConsentCollectionScreen } from '../src/screens/ConsentCollectionScreen';
import { GuardianScreen } from '../src/screens/GuardianScreen';
import { PreferencesScreen } from '../src/screens/PreferencesScreen';
import { RightsScreen } from '../src/screens/RightsScreen';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

async function renderSignedIn(ui: ReactElement, ref = 'CUST-DEMO-0001', actingAs: ActingAs = 'data_principal') {
  const backend = inAppDemoBackend();
  const started = await startConsentSession(backend, ref, actingAs);
  const customer = (await backend.listCustomers()).find((c) => c.external_ref === ref)!;
  await render(
    <AppContext.Provider value={{ backend, customer, info: started.info }}>
      <AppConsentProvider backend={backend} started={started}>
        {ui}
      </AppConsentProvider>
    </AppContext.Provider>,
  );
  return { backend, started };
}

async function grantMarketing(session: Awaited<ReturnType<typeof startConsentSession>>['session']) {
  const notice = await session.currentNotice('en');
  const ids = notice.purposes.filter((p) => p.code === 'marketing').map((p) => p.id);
  return session.giveConsent({ noticeId: notice.id, purposeIds: ids, channel: 'mobile_app' });
}

test('consent collection: itemised notice, language fallback, record consent', async () => {
  await renderSignedIn(<ConsentCollectionScreen />);
  expect(await screen.findByText('How Demo Bank uses your personal data')).toBeTruthy();
  expect(screen.getByText('Data used: name, email, phone')).toBeTruthy();
  expect(screen.getByText('Kept for up to 365 days')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('notice-lang-ta'));
  expect(await screen.findByTestId('notice-fallback')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('notice-lang-hi'));
  expect(await screen.findByText(/डेमो बैंक आपके व्यक्तिगत डेटा/)).toBeTruthy();

  await fireEvent(screen.getByTestId('purpose-switch-analytics'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('record-consent'));
  expect(await screen.findByTestId('grant-result')).toHaveTextContent(/analytics · active/);
});

test('consent collection: the drop-in ConsentSheet records consent', async () => {
  await renderSignedIn(<ConsentCollectionScreen />);
  await fireEvent.press(screen.getByTestId('collection-variant-sheet'));
  const purposeSwitch = await screen.findByLabelText('Consent to Product analytics');
  await fireEvent(purposeSwitch, 'valueChange', true);
  await fireEvent.press(screen.getByTestId('consent-accept-selected'));
  expect(await screen.findByTestId('sheet-result')).toHaveTextContent('Accepted: analytics');
});

test('consent check: denied without consent, allowed with consent_id and ledger_hash after opt-in', async () => {
  await renderSignedIn(<ConsentCheckScreen />);
  await fireEvent.press(screen.getByTestId('send-offers'));
  expect(await screen.findByTestId('check-denied')).toBeTruthy();

  await fireEvent.press(await screen.findByTestId('opt-in-marketing'));
  expect(await screen.findByTestId('opt-in-state')).toHaveTextContent(/recorded/);
  await fireEvent.press(screen.getByTestId('send-offers'));
  expect(await screen.findByTestId('check-allowed')).toBeTruthy();
  expect(screen.getByTestId('check-ledger-hash')).toHaveTextContent(/ledger_hash: [0-9a-f]{64}/);
});

test('preferences: withdraw with confirmation and a reason', async () => {
  const backend = inAppDemoBackend();
  const started = await startConsentSession(backend, 'CUST-DEMO-0001');
  await grantMarketing(started.session);
  const customer = (await backend.listCustomers())[0]!;
  await render(
    <AppContext.Provider value={{ backend, customer, info: started.info }}>
      <AppConsentProvider backend={backend} started={started}>
        <PreferencesScreen />
      </AppConsentProvider>
    </AppContext.Provider>,
  );
  await fireEvent.press(await screen.findByTestId('withdraw-marketing'));
  await fireEvent.changeText(screen.getByTestId('withdraw-reason'), 'Too many messages');
  await fireEvent.press(screen.getByTestId('withdraw-confirm-marketing'));
  expect(await screen.findByTestId('preferences-message')).toHaveTextContent(/Withdrew Marketing messages \(withdrawn/);
  expect(screen.queryByTestId('active-consent-marketing')).toBeNull();
  expect((await backend.checkConsent('CUST-DEMO-0001', 'marketing')).allowed).toBe(false);
});

test('rights: shows the WhatsApp request and files an erasure request', async () => {
  await renderSignedIn(<RightsScreen />);
  expect(await screen.findByText(/via WhatsApp \(ref wamid.DEMO-0001\)/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('request-type-erasure'));
  await fireEvent.changeText(screen.getByTestId('erasure-reason'), 'Closing my account');
  await fireEvent.press(screen.getByTestId('submit-request'));
  expect(await screen.findByTestId('rights-message')).toHaveTextContent(/Filed erasure request, due by \d{4}-\d{2}-\d{2}/);
  expect(screen.getAllByText(/^erasure · /)).toHaveLength(2);
});

test('guardian: the child is refused, the guardian consents and files a nomination', async () => {
  await renderSignedIn(<GuardianScreen />);
  await fireEvent.press(screen.getByTestId('try-as-child'));
  expect(await screen.findByTestId('child-outcome')).toHaveTextContent(/Refused as expected/);
  expect(screen.getByTestId('child-outcome-detail')).toHaveTextContent(/acting_as=guardian \(s\.9\)/);

  await fireEvent.press(screen.getByTestId('sign-in-guardian'));
  expect(await screen.findByTestId('guardian-me')).toHaveTextContent(/acting_as: guardian/);
  await fireEvent(screen.getByTestId('guardian-switch-analytics'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('grant-as-guardian'));
  expect(await screen.findByTestId('guardian-granted')).toHaveTextContent(/analytics · active/);

  await fireEvent.changeText(screen.getByTestId('nominee-name'), 'Meera Rao');
  await fireEvent.changeText(screen.getByTestId('nominee-relationship'), 'aunt');
  await fireEvent.changeText(screen.getByTestId('nominee-phone'), '+919876543210');
  await fireEvent.press(screen.getByTestId('file-nomination'));
  expect(await screen.findByTestId('nomination-result')).toHaveTextContent(/Nomination received, channel app/);
});

test('app: sign in to the in-app demo, see the notice, log out', async () => {
  await render(<App />);
  await fireEvent.press(await screen.findByTestId('sign-in'));
  expect(await screen.findByTestId('signed-in-as', {}, { timeout: 3000 })).toHaveTextContent('CUST-DEMO-0001');
  expect(await screen.findByText('How Demo Bank uses your personal data', {}, { timeout: 3000 })).toBeTruthy();
  await fireEvent.press(screen.getByTestId('logout'));
  expect(await screen.findByTestId('sign-in-screen', {}, { timeout: 3000 })).toBeTruthy();
});

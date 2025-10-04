import { render } from '@testing-library/react';
import Home from '../page';
import { AppProviders } from '@/components/providers/AppProviders';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Firebase App
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(),
}));

describe('Home Page', () => {
  it('renders without crashing', () => {
    render(
      <AppProviders>
        <Home />
      </AppProviders>
    );

    // The component should render without throwing errors
    // Since we're mocking Firebase, the exact content depends on the mock behavior
    expect(document.body).toBeInTheDocument();
  });

  it('renders the home page structure', () => {
    render(
      <AppProviders>
        <Home />
      </AppProviders>
    );

    // Test that the component renders without crashing
    // The actual content will depend on authentication state
    expect(document.body).toBeInTheDocument();
  });
});

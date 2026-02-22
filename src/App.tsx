import { AuthProvider, useAuth } from './AuthContext';
import { AuthPage } from './AuthPage';
import { Dashboard } from './Dashboard';

function AppContent() {
  const { token } = useAuth();
  return token ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

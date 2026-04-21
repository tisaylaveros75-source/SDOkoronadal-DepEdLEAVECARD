import AppProvider from '@/components/AppProvider';
import App from '@/components/App';

export default function Home() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

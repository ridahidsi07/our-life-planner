import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPwaServiceWorker } from './utils/pwaManager';

createRoot(document.getElementById('root')!).render(<App />);
void registerPwaServiceWorker();

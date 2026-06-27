import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import CreaturesListPage from './pages/CreaturesListPage';
import CreatureDetailPage from './pages/CreatureDetailPage';
import CreatureFormPage from './pages/CreatureFormPage';
import ItemsListPage from './pages/ItemsListPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ItemFormPage from './pages/ItemFormPage';
import EncounterGeneratorPage from './pages/EncounterGeneratorPage';
import ShopGeneratorPage from './pages/ShopGeneratorPage';

export default function App() {
  return (
    <div className="min-h-screen bg-[#14121a] text-zinc-100">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/creature" element={<CreaturesListPage />} />
        <Route path="/creature/nuova" element={<CreatureFormPage />} />
        <Route path="/creature/:id" element={<CreatureDetailPage />} />
        <Route path="/creature/:id/modifica" element={<CreatureFormPage editMode />} />
        <Route path="/oggetti" element={<ItemsListPage />} />
        <Route path="/oggetti/nuovo" element={<ItemFormPage />} />
        <Route path="/oggetti/:id" element={<ItemDetailPage />} />
        <Route path="/oggetti/:id/modifica" element={<ItemFormPage editMode />} />
        <Route path="/incontri" element={<EncounterGeneratorPage />} />
        <Route path="/negozi" element={<ShopGeneratorPage />} />
      </Routes>
    </div>
  );
}

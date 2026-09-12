import React from 'react';
import { I18nProvider } from './i18n/useDocTranslation';
import { Navbar } from './components/layout/Navbar';
import { VpnNoticeBanner } from './components/sections/VpnNoticeBanner';
import { HeroSection } from './components/sections/HeroSection';
import { AppsGrid } from './components/sections/AppsGrid';
import { AlfiSection } from './components/sections/AlfiSection';
import { ArchitectureSection } from './components/sections/ArchitectureSection';
import { TechStackSection } from './components/sections/TechStackSection';
import { Footer } from './components/layout/Footer';

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <div className="min-h-screen flex flex-col bg-[#0b1326] text-[#f0f6fc]">
        <Navbar />
        <main className="flex-grow">
          <VpnNoticeBanner />
          <HeroSection />
          <AppsGrid />
          <AlfiSection />
          <ArchitectureSection />
          <TechStackSection />
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
};

export default App;

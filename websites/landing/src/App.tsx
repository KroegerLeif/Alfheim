import React from 'react';
import { I18nProvider } from './i18n/useDocTranslation';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/sections/HeroSection';
import { LeanCoreSection } from './components/sections/LeanCoreSection';
import { AppsGrid } from './components/sections/AppsGrid';
import { IntegrationsSection } from './components/sections/IntegrationsSection';
import { RoadmapSection } from './components/sections/RoadmapSection';
import { Footer } from './components/layout/Footer';

/** Landing page: hero, Lean Core, modules, integrations and roadmap. */
export const App: React.FC = () => {
  return (
    <I18nProvider>
      <div className="min-h-screen flex flex-col bg-canvas text-fg">
        <Navbar />
        <main className="flex-grow">
          <HeroSection />
          <LeanCoreSection />
          <AppsGrid />
          <IntegrationsSection />
          <RoadmapSection />
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
};

export default App;

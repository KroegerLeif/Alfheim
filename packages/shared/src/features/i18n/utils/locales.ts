import deCommon from '../locales/de/common.json';
import deDashboard from '../locales/de/dashboard.json';
import deShopping from '../locales/de/shopping.json';
import dePantry from '../locales/de/pantry.json';
import deMaintenance from '../locales/de/maintenance.json';
import deChores from '../locales/de/chores.json';
import deDocs from '../locales/de/docs.json';

import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enShopping from '../locales/en/shopping.json';
import enPantry from '../locales/en/pantry.json';
import enMaintenance from '../locales/en/maintenance.json';
import enChores from '../locales/en/chores.json';
import enDocs from '../locales/en/docs.json';

import plCommon from '../locales/pl/common.json';
import plDashboard from '../locales/pl/dashboard.json';
import plShopping from '../locales/pl/shopping.json';
import plPantry from '../locales/pl/pantry.json';
import plMaintenance from '../locales/pl/maintenance.json';
import plChores from '../locales/pl/chores.json';
import plDocs from '../locales/pl/docs.json';

import { Language } from './types';

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (target && typeof target === 'object' && source && typeof source === 'object') {
    Object.keys(source).forEach((key) => {
      if (source[key] && typeof source[key] === 'object') {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

export const deMessages = [
  deCommon,
  deDashboard,
  deShopping,
  dePantry,
  deMaintenance,
  deChores,
  deDocs,
].reduce((acc, curr) => deepMerge(acc, curr), {});

export const enMessages = [
  enCommon,
  enDashboard,
  enShopping,
  enPantry,
  enMaintenance,
  enChores,
  enDocs,
].reduce((acc, curr) => deepMerge(acc, curr), {});

export const plMessages = [
  plCommon,
  plDashboard,
  plShopping,
  plPantry,
  plMaintenance,
  plChores,
  plDocs,
].reduce((acc, curr) => deepMerge(acc, curr), {});

export const messages: Record<Language, any> = {
  de: deMessages,
  en: enMessages,
  pl: plMessages,
};

export function getSharedMessages(locale: Language) {
  return messages[locale] || messages.de;
}


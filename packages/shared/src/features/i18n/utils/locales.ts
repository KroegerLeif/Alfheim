import deCommon from '../locales/de/common.json';
import deDashboard from '../locales/de/dashboard.json';
import deShopping from '../locales/de/shopping.json';
import dePantry from '../locales/de/pantry.json';
import deMaintenance from '../locales/de/maintenance.json';
import deChores from '../locales/de/chores.json';
import deDocs from '../locales/de/docs.json';
import deLibrary from '../locales/de/library.json';
import deBudget from '../locales/de/budget.json';
import deChat from '../locales/de/chat.json';
import deWorkout from '../locales/de/workout.json';

import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enShopping from '../locales/en/shopping.json';
import enPantry from '../locales/en/pantry.json';
import enMaintenance from '../locales/en/maintenance.json';
import enChores from '../locales/en/chores.json';
import enDocs from '../locales/en/docs.json';
import enLibrary from '../locales/en/library.json';
import enBudget from '../locales/en/budget.json';
import enChat from '../locales/en/chat.json';
import enWorkout from '../locales/en/workout.json';

import plCommon from '../locales/pl/common.json';
import plDashboard from '../locales/pl/dashboard.json';
import plShopping from '../locales/pl/shopping.json';
import plPantry from '../locales/pl/pantry.json';
import plMaintenance from '../locales/pl/maintenance.json';
import plChores from '../locales/pl/chores.json';
import plDocs from '../locales/pl/docs.json';
import plLibrary from '../locales/pl/library.json';
import plBudget from '../locales/pl/budget.json';
import plChat from '../locales/pl/chat.json';
import plWorkout from '../locales/pl/workout.json';

import { Language } from './types';

/** A nested translation catalogue as loaded from the JSON locale files. */
type MessageTree = Record<string, unknown>;

function isMessageTree(value: unknown): value is MessageTree {
  return Boolean(value) && typeof value === 'object';
}

function deepMerge(target: MessageTree, source: MessageTree): MessageTree {
  const output: MessageTree = { ...target };
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = target[key];
    output[key] =
      isMessageTree(sourceValue) && isMessageTree(targetValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  });
  return output;
}

/**
 * Shape of the merged catalogue. German is the master language, so its files define the keys;
 * the key-parity tests keep English and Polish in line with it.
 */
export type SharedMessages = typeof deCommon &
  typeof deDashboard &
  typeof deShopping &
  typeof dePantry &
  typeof deMaintenance &
  typeof deChores &
  typeof deDocs &
  typeof deLibrary &
  typeof deBudget &
  typeof deChat &
  typeof deWorkout;

function mergeMessages(parts: MessageTree[]): SharedMessages {
  return parts.reduce<MessageTree>((acc, curr) => deepMerge(acc, curr), {}) as SharedMessages;
}

export const deMessages = mergeMessages([
  deCommon,
  deDashboard,
  deShopping,
  dePantry,
  deMaintenance,
  deChores,
  deDocs,
  deLibrary,
  deBudget,
  deChat,
  deWorkout,
]);

export const enMessages = mergeMessages([
  enCommon,
  enDashboard,
  enShopping,
  enPantry,
  enMaintenance,
  enChores,
  enDocs,
  enLibrary,
  enBudget,
  enChat,
  enWorkout,
]);

export const plMessages = mergeMessages([
  plCommon,
  plDashboard,
  plShopping,
  plPantry,
  plMaintenance,
  plChores,
  plDocs,
  plLibrary,
  plBudget,
  plChat,
  plWorkout,
]);

export const messages: Record<Language, SharedMessages> = {
  de: deMessages,
  en: enMessages,
  pl: plMessages,
};

export function getSharedMessages(locale: Language) {
  return messages[locale] || messages.de;
}

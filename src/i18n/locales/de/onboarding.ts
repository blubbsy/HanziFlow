import type { onboarding as en } from '../en/onboarding';

export const onboarding: Partial<Record<keyof typeof en, string>> = {
  'onboarding.stepOf': 'Schritt {n} von {total}',
  'onboarding.skip': 'Vorerst überspringen',
  'onboarding.back': 'Zurück',
  'onboarding.next': 'Weiter',
  'onboarding.start': 'Erste Lerneinheit starten',
  'onboarding.startNote': 'Deine erste Einheit hat nur {count, plural, one {# Wort} other {# Wörter}}. Alles lässt sich später in den Einstellungen ändern.',
  'onboarding.language.title': 'Was möchtest du lernen?',
  'onboarding.language.desc': 'Weitere Kurse kannst du jederzeit hinzufügen. Jeder behält seinen eigenen Fortschritt.',
  'onboarding.level.title': 'Wie viel kannst du schon?',
  'onboarding.level.beginner': 'Ganz am Anfang',
  'onboarding.level.beginnerDesc': 'Mit den allerersten Wörtern starten.',
  'onboarding.level.some': 'Ich kann schon etwas',
  'onboarding.level.someDesc': 'Ein kurzer Test bestimmt dein Niveau und überspringt Bekanntes.',
  'onboarding.goal.title': 'Wie viel Zeit pro Tag?',
  'onboarding.goal.light': 'Locker',
  'onboarding.goal.regular': 'Regelmäßig',
  'onboarding.goal.intense': 'Intensiv',
  'onboarding.goal.desc': 'Etwa {min} Min. pro Tag · {count} Karten pro Einheit',
};

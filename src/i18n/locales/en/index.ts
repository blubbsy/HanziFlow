import { achievements } from './achievements';
import { badges } from './badges';
import { bulk } from './bulk';
import { catalogue } from './catalogue';
import { common } from './common';
import { courses } from './courses';
import { dashboard } from './dashboard';
import { dictionary } from './dictionary';
import { english } from './english';
import { errors } from './errors';
import { grammar } from './grammar';
import { insights } from './insights';
import { modes } from './modes';
import { placement } from './placement';
import { recs } from './recs';
import { settings } from './settings';
import { shell } from './shell';
import { study } from './study';
import { switcher } from './switcher';
import { sync } from './sync';
import { topics } from './topics';
import { wiki } from './wiki';

export const en = {
  ...achievements,
  ...badges,
  ...bulk,
  ...catalogue,
  ...common,
  ...courses,
  ...dashboard,
  ...dictionary,
  ...english,
  ...errors,
  ...grammar,
  ...insights,
  ...modes,
  ...placement,
  ...recs,
  ...settings,
  ...shell,
  ...study,
  ...switcher,
  ...sync,
  ...topics,
  ...wiki,
} as const;

/** Every translatable string. The English table is the source of truth; `zh` must be complete (checked by tsc). */
export type MessageKey = keyof typeof en;

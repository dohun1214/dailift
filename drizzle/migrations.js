// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_workout_targets.sql';
import m0002 from './0002_workout_photos.sql';
import m0003 from './0003_photo_uploaded.sql';
import m0004 from './0004_set_plan.sql';
import m0005 from './0005_supplements.sql';
import m0006 from './0006_diet.sql';
import m0007 from './0007_diet_sets.sql';
import m0008 from './0008_processed_food_cache.sql';
import m0009 from './0009_cardio.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009
    }
  }
  
import {
  cliExecute,
  effectModifier,
  equippedAmount,
  haveEquipped,
  itemAmount,
  myBasestat,
  myHp,
  myMaxhp,
  myTurncount,
  restoreHp,
  runCombat,
  sell,
  use,
  visitUrl,
} from "kolmafia";
import {
  $coinmaster,
  $effect,
  $effects,
  $familiar,
  $item,
  $items,
  $location,
  $monster,
  $monsters,
  $skill,
  $slot,
  $stat,
  AutumnAton,
  ensureEffect,
  get,
  have,
  Macro,
  set,
  uneffect,
} from "libram";
import { Priority, Quest, Task } from "../engine/task";
import { Guards, OutfitSpec, step } from "grimoire-kolmafia";
import { Priorities } from "../engine/priority";
import { CombatStrategy } from "../engine/combat";
import { atLevel, debug, YouRobot } from "../lib";
import { forceItemPossible, yellowRayPossible } from "../engine/resources";
import { toTempPref } from "../args";
import { customRestoreMp, fillHp } from "../engine/moods";

export function flyersDone(): boolean {
  const buffer = 1000;
  return get("flyeredML") >= 10000 + buffer;
}

const Flyers: Task[] = [
  {
    name: "Flyers Start",
    after: ["Enrage"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => have($item`rock band flyers`) || get("sidequestArenaCompleted") !== "none",
    outfit: { equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin` },
    do: (): void => {
      visitUrl("bigisland.php?place=concert&pwd");
    },
    freeaction: true,
    limit: { tries: 1 },
  },
  {
    name: "Flyers End",
    after: ["Flyers Start"],
    priority: () => Priorities.Free,
    ready: () => flyersDone() && YouRobot.canUse($slot`hat`), // Buffer for mafia tracking
    completed: () => get("sidequestArenaCompleted") !== "none",
    outfit: { equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin` },
    do: (): void => {
      visitUrl("bigisland.php?place=concert&pwd");
      cliExecute("refresh inv");
      if (have($item`rock band flyers`)) {
        debug("Mafia tracking was incorrect for rock band flyers; continuing to flyer...");
        set(
          toTempPref("flyeredML_buffer"),
          get(toTempPref("flyeredML_buffer"), 0) + (get("flyeredML") - 9900)
        );
        set("flyeredML", 9900);
      } else if (get(toTempPref("flyeredML_buffer"), 0) > 0) {
        const real = get("flyeredML") + get(toTempPref("flyeredML_buffer"), 0);
        debug(`Mafia tracking was incorrect for rock band flyers; quest completed at ${real}`);
      }
    },
    freeaction: true,
    limit: { soft: 10, message: "See https://kolmafia.us/threads/flyeredml-tracking-wrong.27567/" },
  },
];

const Lighthouse: Task[] = [
  // Saber into more lobsterfrogmen
  // Or backup into the Boss Bat's lair
  {
    name: "Lighthouse",
    after: ["Enrage"],
    ready: () => step("questL04Bat") >= 3 || have($item`Fourth of May Cosplay Saber`),
    completed: () =>
      itemAmount($item`barrel of gunpowder`) >= 5 ||
      get("sidequestLighthouseCompleted") !== "none" ||
      !have($item`backup camera`) ||
      !have($item`Fourth of May Cosplay Saber`),
    priority: (): Priority => {
      if (AutumnAton.have()) {
        if ($location`Sonofa Beach`.turnsSpent === 0) return Priorities.GoodAutumnaton;
        else if (myTurncount() < 400) return Priorities.BadAutumnaton;
      }
      return Priorities.None;
    },
    do: $location`Sonofa Beach`,
    outfit: (): OutfitSpec => {
      if (AutumnAton.have() && $location`Sonofa Beach`.turnsSpent === 0) return {};
      if (AutumnAton.have() || !have($item`Fourth of May Cosplay Saber`))
        return { modifier: "+combat" };

      // Look for the first lobsterfrogman
      if (
        get("_saberForceMonster") !== $monster`lobsterfrogman` ||
        get("_saberForceMonsterCount") === 0
      ) {
        return { modifier: "+combat", equip: $items`Fourth of May Cosplay Saber` };
      }

      // Reuse the force to track more lobsterfrogman
      if (get("_saberForceMonsterCount") === 1 && itemAmount($item`barrel of gunpowder`) < 4) {
        return { equip: $items`Fourth of May Cosplay Saber` };
      }

      return {};
    },
    combat: new CombatStrategy()
      .macro(() => {
        if (
          equippedAmount($item`Fourth of May Cosplay Saber`) > 0 &&
          !AutumnAton.have() &&
          get("_saberForceUses") < 5 &&
          (get("_saberForceMonster") !== $monster`lobsterfrogman` ||
            get("_saberForceMonsterCount") === 0 ||
            (get("_saberForceMonsterCount") === 1 && itemAmount($item`barrel of gunpowder`) < 4))
        ) {
          return new Macro().skill($skill`Use the Force`);
        }
        return new Macro();
      })
      .kill($monster`lobsterfrogman`),
    orbtargets: () => undefined,
    expectbeatenup: () => get("lastEncounter") === "Zerg Rush",
    choices: { 1387: 2 },
    limit: {
      tries: 20,
      guard: Guards.create(
        () => itemAmount($item`figurine of a sleek seal`),
        (sleek) =>
          !AutumnAton.have() ||
          $location`Sonofa Beach`.turnsSpent > 0 ||
          ($location`Sonofa Beach`.turnsSpent === 0 &&
            itemAmount($item`figurine of a sleek seal`) === sleek + 3)
      ),
    },
  },
  {
    name: "Lighthouse Basic",
    after: ["Enrage", "Lighthouse"],
    priority: (): Priority => {
      if (AutumnAton.have()) {
        if ($location`Sonofa Beach`.turnsSpent === 0) return Priorities.GoodAutumnaton;
        else return Priorities.BadAutumnaton;
      }
      return Priorities.None;
    },
    completed: () =>
      itemAmount($item`barrel of gunpowder`) >= 5 || get("sidequestLighthouseCompleted") !== "none",
    do: $location`Sonofa Beach`,
    outfit: { modifier: "+combat" },
    combat: new CombatStrategy().kill($monster`lobsterfrogman`),
    orbtargets: () => undefined,
    expectbeatenup: () => get("lastEncounter") === "Zerg Rush",
    limit: { soft: 40 },
  },
  {
    name: "Lighthouse End",
    after: ["Lighthouse Basic"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => get("sidequestLighthouseCompleted") !== "none",
    outfit: { equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin` },
    do: (): void => {
      visitUrl("bigisland.php?place=lighthouse&action=pyro&pwd");
    },
    freeaction: true,
    limit: { tries: 1 },
  },
];

const Junkyard: Task[] = [
  {
    name: "Junkyard Start",
    after: ["Enrage"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => have($item`molybdenum magnet`) || get("sidequestJunkyardCompleted") !== "none",
    outfit: { equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin` },
    do: (): void => {
      visitUrl("bigisland.php?action=junkman&pwd");
    },
    freeaction: true,
    limit: { tries: 1 },
  },
  {
    name: "Junkyard Hammer",
    after: ["Junkyard Start"],
    prepare: (): void => {
      fillHp();
      customRestoreMp(50);
    },
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => have($item`molybdenum hammer`) || get("sidequestJunkyardCompleted") !== "none",
    acquire: [{ item: $item`seal tooth` }],
    outfit: {
      equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, Space Trip safety headphones, autumn debris shield`,
      familiar: have($familiar`Reagnimated Gnome`)
        ? $familiar`Reagnimated Gnome`
        : have($familiar`Cookbookbat`)
        ? $familiar`Cookbookbat`
        : have($familiar`Nosy Nose`)
        ? $familiar`Nosy Nose`
        : undefined,
      avoid: $items`carnivorous potted plant`,
    },
    do: $location`Next to that Barrel with Something Burning in it`,
    orbtargets: () => $monsters`batwinged gremlin, batwinged gremlin (tool)`,
    combat: new CombatStrategy()
      .macro(
        new Macro()
          .trySkill($skill`Curse of Weaksauce`)
          .trySkill($skill`Micrometeorite`)
          .while_(
            "!match whips out && !times 28 && !hpbelow 30",
            new Macro().item($item`seal tooth`)
          )
          .if_("match whips out", new Macro().item(`molybdenum magnet`)),
        $monster`batwinged gremlin (tool)`
      )
      .banish($monster`A.M.C. gremlin`)
      .kill($monster`batwinged gremlin (tool)`)
      .banish($monsters`batwinged gremlin, vegetable gremlin`),
    nofightingfamiliars: true,
    limit: { soft: 15 },
  },
  {
    name: "Junkyard Wrench",
    after: ["Junkyard Start"],
    prepare: (): void => {
      fillHp();
      customRestoreMp(50);
    },
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () =>
      have($item`molybdenum crescent wrench`) || get("sidequestJunkyardCompleted") !== "none",
    acquire: [{ item: $item`seal tooth` }],
    outfit: {
      equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, Space Trip safety headphones, autumn debris shield`,
      familiar: have($familiar`Reagnimated Gnome`)
        ? $familiar`Reagnimated Gnome`
        : have($familiar`Cookbookbat`)
        ? $familiar`Cookbookbat`
        : have($familiar`Nosy Nose`)
        ? $familiar`Nosy Nose`
        : undefined,
      avoid: $items`carnivorous potted plant`,
    },
    do: $location`Over Where the Old Tires Are`,
    orbtargets: () => $monsters`erudite gremlin, erudite gremlin (tool)`,
    combat: new CombatStrategy()
      .macro(
        new Macro()
          .trySkill($skill`Curse of Weaksauce`)
          .trySkill($skill`Micrometeorite`)
          .while_(
            "!match whips out && !times 28 && !hpbelow 30",
            new Macro().item($item`seal tooth`)
          )
          .if_("match whips out", new Macro().item(`molybdenum magnet`)),
        $monster`erudite gremlin (tool)`
      )
      .banish($monster`A.M.C. gremlin`)
      .kill($monster`erudite gremlin (tool)`)
      .banish($monsters`erudite gremlin, spider gremlin`),
    nofightingfamiliars: true,
    limit: { soft: 15 },
  },
  {
    name: "Junkyard Pliers",
    after: ["Junkyard Start"],
    acquire: [{ item: $item`seal tooth` }],
    prepare: (): void => {
      fillHp();
      customRestoreMp(50);
    },
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => have($item`molybdenum pliers`) || get("sidequestJunkyardCompleted") !== "none",
    outfit: {
      equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, Space Trip safety headphones, autumn debris shield`,
      familiar: have($familiar`Reagnimated Gnome`)
        ? $familiar`Reagnimated Gnome`
        : have($familiar`Cookbookbat`)
        ? $familiar`Cookbookbat`
        : have($familiar`Nosy Nose`)
        ? $familiar`Nosy Nose`
        : undefined,
      avoid: $items`carnivorous potted plant`,
    },
    do: $location`Near an Abandoned Refrigerator`,
    orbtargets: () => $monsters`spider gremlin, spider gremlin (tool)`,
    combat: new CombatStrategy()
      .macro(
        new Macro()
          .trySkill($skill`Curse of Weaksauce`)
          .trySkill($skill`Micrometeorite`)
          .while_(
            "!match whips out && !times 28 && !hpbelow 30",
            new Macro().item($item`seal tooth`)
          )
          .if_("match whips out", new Macro().item(`molybdenum magnet`)),
        $monster`spider gremlin (tool)`
      )
      .banish($monster`A.M.C. gremlin`)
      .kill($monster`spider gremlin (tool)`)
      .banish($monsters`batwinged gremlin, spider gremlin`),
    nofightingfamiliars: true,
    limit: { soft: 15 },
  },
  {
    name: "Junkyard Screwdriver",
    after: ["Junkyard Start"],
    prepare: (): void => {
      fillHp();
      customRestoreMp(50);
    },
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () =>
      have($item`molybdenum screwdriver`) || get("sidequestJunkyardCompleted") !== "none",
    acquire: [{ item: $item`seal tooth` }],
    outfit: {
      equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, Space Trip safety headphones, autumn debris shield`,
      familiar: have($familiar`Reagnimated Gnome`)
        ? $familiar`Reagnimated Gnome`
        : have($familiar`Cookbookbat`)
        ? $familiar`Cookbookbat`
        : have($familiar`Nosy Nose`)
        ? $familiar`Nosy Nose`
        : undefined,
      avoid: $items`carnivorous potted plant`,
    },
    do: $location`Out by that Rusted-Out Car`,
    orbtargets: () => $monsters`vegetable gremlin, vegetable gremlin (tool)`,
    combat: new CombatStrategy()
      .macro(
        new Macro()
          .trySkill($skill`Curse of Weaksauce`)
          .trySkill($skill`Micrometeorite`)
          .while_(
            "!match whips out && !times 28 && !hpbelow 30",
            new Macro().item($item`seal tooth`)
          )
          .if_("match whips out", new Macro().item(`molybdenum magnet`)),
        $monster`vegetable gremlin (tool)`
      )
      .banish($monster`A.M.C. gremlin`)
      .kill($monster`vegetable gremlin (tool)`)
      .banish($monsters`erudite gremlin, vegetable gremlin`),
    nofightingfamiliars: true,
    limit: { soft: 15 },
  },
  {
    name: "Junkyard End",
    after: ["Junkyard Hammer", "Junkyard Wrench", "Junkyard Pliers", "Junkyard Screwdriver"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => get("sidequestJunkyardCompleted") !== "none",
    outfit: {
      equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
    },
    do: (): void => {
      visitUrl("bigisland.php?action=junkman&pwd");
    },
    freeaction: true,
    limit: { tries: 1 },
  },
];

const Orchard: Task[] = [
  {
    name: "Orchard Hatching",
    after: ["Enrage"],
    completed: () =>
      have($item`filthworm hatchling scent gland`) ||
      have($effect`Filthworm Larva Stench`) ||
      have($item`filthworm drone scent gland`) ||
      have($effect`Filthworm Drone Stench`) ||
      have($item`filthworm royal guard scent gland`) ||
      have($effect`Filthworm Guard Stench`) ||
      have($item`heart of the filthworm queen`) ||
      get("sidequestOrchardCompleted") !== "none",
    do: $location`The Hatching Chamber`,
    outfit: () => {
      if (yellowRayPossible()) return {};
      else return { modifier: "item" };
    },
    combat: new CombatStrategy()
      .yellowRay($monster`larval filthworm`)
      .startingMacro(Macro.trySkill($skill`Extract Jelly`))
      .macro(() =>
        Macro.externalIf(
          have($skill`Emotionally Chipped`) &&
            get("_feelEnvyUsed") < 3 &&
            have($effect`Everything Looks Yellow`),
          Macro.trySkill($skill`Feel Envy`),
          Macro.trySkill($skill`Fire Extinguisher: Polar Vortex`)
        )
      ),
    limit: { soft: 10 },
  },
  {
    name: "Orchard Feeding",
    after: ["Orchard Hatching"],
    completed: () =>
      have($item`filthworm drone scent gland`) ||
      have($effect`Filthworm Drone Stench`) ||
      have($item`filthworm royal guard scent gland`) ||
      have($effect`Filthworm Guard Stench`) ||
      have($item`heart of the filthworm queen`) ||
      get("sidequestOrchardCompleted") !== "none",
    do: $location`The Feeding Chamber`,
    outfit: () => {
      if (yellowRayPossible()) return {};
      else if (have($item`industrial fire extinguisher`) && get("_fireExtinguisherCharge") >= 10)
        return {
          equip: $items`industrial fire extinguisher`,
        };
      else return { modifier: "item" };
    },
    combat: new CombatStrategy()
      .yellowRay($monster`filthworm drone`)
      .startingMacro(Macro.trySkill($skill`Extract Jelly`))
      .macro(() =>
        Macro.externalIf(
          have($skill`Emotionally Chipped`) &&
            get("_feelEnvyUsed") < 3 &&
            have($effect`Everything Looks Yellow`),
          Macro.trySkill($skill`Feel Envy`),
          Macro.trySkill($skill`Fire Extinguisher: Polar Vortex`)
        )
      ),
    effects: $effects`Filthworm Larva Stench`,
    limit: { soft: 10 },
  },
  {
    name: "Orchard Guard",
    after: ["Orchard Feeding"],
    completed: () =>
      have($item`filthworm royal guard scent gland`) ||
      have($effect`Filthworm Guard Stench`) ||
      have($item`heart of the filthworm queen`) ||
      get("sidequestOrchardCompleted") !== "none",
    do: $location`The Royal Guard Chamber`,
    effects: $effects`Filthworm Drone Stench`,
    outfit: () => {
      if (yellowRayPossible()) return {};
      else if (have($item`industrial fire extinguisher`) && get("_fireExtinguisherCharge") >= 10)
        return {
          equip: $items`industrial fire extinguisher`,
        };
      else return { modifier: "item" };
    },
    combat: new CombatStrategy()
      .yellowRay($monster`filthworm royal guard`)
      .startingMacro(Macro.trySkill($skill`Extract Jelly`))
      .macro(() =>
        Macro.externalIf(
          have($skill`Emotionally Chipped`) &&
            get("_feelEnvyUsed") < 3 &&
            have($effect`Everything Looks Yellow`),
          Macro.trySkill($skill`Feel Envy`),
          Macro.trySkill($skill`Fire Extinguisher: Polar Vortex`)
        )
      ),
    limit: { soft: 10 },
  },
  {
    name: "Orchard Queen",
    after: ["Orchard Guard"],
    completed: () =>
      have($item`heart of the filthworm queen`) || get("sidequestOrchardCompleted") !== "none",
    do: $location`The Filthworm Queen's Chamber`,
    effects: $effects`Filthworm Guard Stench`,
    combat: new CombatStrategy().kill().macro(Macro.trySkill($skill`Extract Jelly`)),
    limit: { tries: 2 }, // allow wanderer
    boss: true,
  },
  {
    name: "Orchard Finish",
    after: ["Orchard Queen", "Open Orchard"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => get("sidequestOrchardCompleted") !== "none",
    outfit: { equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin` },
    do: (): void => {
      visitUrl("bigisland.php?place=orchard&action=stand&pwd");
    },
    freeaction: true,
    limit: { tries: 1 },
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Nuns: Task[] = [
  {
    name: "Nuns",
    after: ["Open Nuns"],
    ready: () => YouRobot.canUse($slot`hat`),
    completed: () => get("sidequestNunsCompleted") !== "none",
    priority: () => (have($effect`Winklered`) ? Priorities.Effect : Priorities.None),
    prepare: () => {
      if (have($item`SongBoom™ BoomBox`) && get("boomBoxSong") !== "Total Eclipse of Your Meat")
        cliExecute("boombox meat");
      if (!get("concertVisited")) ensureEffect($effect`Winklered`);
      $items`flapper fly, autumn dollar, pink candy heart`
        .filter((i) => have(i, 2) && !have(effectModifier(i, "Effect")))
        .forEach((i) => use(i));
      if (have($item`pocket wish`) && !have($effect`Sinuses For Miles`)) {
        cliExecute("genie effect sinuses for miles");
      }
      if (have($item`savings bond`)) ensureEffect($effect`Earning Interest`);
      fillHp();
    },
    do: $location`The Themthar Hills`,
    post: () => {
      if (
        get("sidequestNunsCompleted") !== "none" &&
        have($effect`Friendly Chops`) &&
        have($item`soft green echo eyedrop antidote`)
      ) {
        uneffect($effect`Friendly Chops`);
      }
    },
    outfit: () => {
      if (have($familiar`Trick-or-Treating Tot`) && have($item`li'l pirate costume`)) {
        return {
          modifier: "meat",
          familiar: $familiar`Trick-or-Treating Tot`,
          equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, li'l pirate costume`,
        };
      }
      return {
        modifier: "meat",
        equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin, amulet coin`, // Use amulet coin (if we have) to avoid using orb
      };
    },
    freecombat: true, // Do not equip cmg or carn plant
    combat: new CombatStrategy()
      .macro(
        new Macro()
          .trySkill($skill`Micrometeorite`)
          .trySkill($skill`Curse of Weaksauce`)
          .trySkill($skill`Bowl Straight Up`)
          .trySkill($skill`Sing Along`)
      )
      .killHard(),
    limit: { soft: 30 },
    boss: true,
  },
];

export const WarQuest: Quest = {
  name: "War",
  tasks: [
    {
      name: "Start",
      after: [],
      ready: () => atLevel(12) && councilSafe(),
      completed: () => step("questL12War") !== -1,
      do: () => visitUrl("council.php"),
      limit: { tries: 1 },
      freeaction: true,
    },
    {
      name: "Outfit Hippy",
      after: ["Misc/Unlock Island"],
      ready: () =>
        (get("skillLevel144") === 0 ||
          atLevel(12) ||
          get("_universeCalculated") >= get("skillLevel144")) &&
        myTurncount() >= 150,
      completed: () =>
        (have($item`filthy corduroys`) && have($item`filthy knitted dread sack`)) ||
        (have($item`beer helmet`) &&
          have($item`distressed denim pants`) &&
          have($item`bejeweled pledge pin`)),
      do: $location`Hippy Camp`,
      limit: { soft: 10 },
      choices: () => {
        return {
          136: have($item`filthy corduroys`) ? 2 : 1,
          137: have($item`filthy corduroys`) ? 1 : 2,
        };
      },
      outfit: () => {
        if (forceItemPossible())
          return {
            modifier: "+combat",
          };
        else
          return {
            modifier: "item",
          };
      },
      combat: new CombatStrategy().forceItems().macro(Macro.trySkill($skill`Extract Jelly`)),
    },
    {
      name: "Outfit Frat",
      after: ["Start", "Outfit Hippy"],
      ready: () => YouRobot.canUse($slot`hat`),
      completed: () =>
        have($item`beer helmet`) &&
        have($item`distressed denim pants`) &&
        have($item`bejeweled pledge pin`),
      do: $location`Frat House`,
      limit: { soft: 10 },
      choices: { 142: 3, 143: 3, 144: 3, 145: 1, 146: 3, 1433: 3 },
      outfit: () => {
        if (forceItemPossible())
          return {
            equip: $items`filthy corduroys, filthy knitted dread sack`,
            modifier: "+combat",
          };
        else
          return {
            equip: $items`filthy corduroys, filthy knitted dread sack`,
            modifier: "item",
          };
      },
      combat: new CombatStrategy().forceItems(),
    },
    {
      name: "Enrage",
      after: ["Start", "Misc/Unlock Island", "Misc/Unlock Island Submarine", "Outfit Frat"],
      ready: () =>
        myBasestat($stat`mysticality`) >= 70 &&
        myBasestat($stat`moxie`) >= 70 &&
        YouRobot.canUse($slot`hat`),
      completed: () => step("questL12War") >= 1,
      prepare: () => {
        // Restore a bit more HP than usual
        if (myHp() < 80 && myHp() < myMaxhp()) restoreHp(myMaxhp() < 80 ? myMaxhp() : 80);
      },
      outfit: () => {
        const result = <OutfitSpec>{
          equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
          modifier: "-combat",
        };
        if (!have($skill`Comprehensive Cartography`))
          // eslint-disable-next-line libram/verify-constants
          result.equip?.push($item`candy cane sword cane`);
        return result;
      },
      combat: new CombatStrategy().macro(Macro.trySkill($skill`Extract Jelly`)),
      do: $location`Wartime Hippy Camp (Frat Disguise)`,
      choices: () => {
        // eslint-disable-next-line libram/verify-constants
        if (haveEquipped($item`candy cane sword cane`))
          return { 139: 4, 140: 4, 141: 3, 142: 3, 143: 3, 144: 3, 145: 1, 146: 3, 1433: 3 };
        else return { 139: 3, 140: 3, 141: 3, 142: 3, 143: 3, 144: 3, 145: 1, 146: 3, 1433: 3 };
      },
      limit: { soft: 20 },
    },
    ...Flyers,
    ...Lighthouse,
    ...Junkyard,
    {
      name: "Open Orchard",
      after: ["Flyers End", "Lighthouse End", "Junkyard End"],
      ready: () => YouRobot.canUse($slot`hat`),
      completed: () => get("hippiesDefeated") >= 64,
      outfit: {
        equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
      },
      do: $location`The Battlefield (Frat Uniform)`,
      post: dimesForGarters,
      combat: new CombatStrategy()
        .kill()
        .macro(
          Macro.trySkill($skill`%fn, let's pledge allegiance to a Zone`).trySkill(
            $skill`Extract Jelly`
          )
        ),
      limit: { tries: 10 },
    },
    ...Orchard,
    {
      name: "Open Nuns",
      after: ["Orchard Finish"],
      ready: () => YouRobot.canUse($slot`hat`),
      completed: () => get("hippiesDefeated") >= 192,
      outfit: {
        equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
      },
      do: $location`The Battlefield (Frat Uniform)`,
      combat: new CombatStrategy().kill().macro(Macro.trySkill($skill`Extract Jelly`)),
      limit: { tries: 9 },
    },
    // ...Nuns,
    {
      name: "Clear",
      after: ["Open Nuns"],
      ready: () => YouRobot.canUse($slot`hat`),
      completed: () => get("hippiesDefeated") >= 1000,
      outfit: {
        equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
      },
      do: $location`The Battlefield (Frat Uniform)`,
      post: dimesForGarters,
      combat: new CombatStrategy().kill().macro(Macro.trySkill($skill`Extract Jelly`)),
      limit: { tries: 52 },
    },
    {
      name: "Boss Hippie",
      after: ["Clear"],
      ready: () => YouRobot.canUse($slot`hat`),
      completed: () => step("questL12War") === 999,
      outfit: {
        equip: $items`beer helmet, distressed denim pants, bejeweled pledge pin`,
      },
      prepare: () => {
        dimesForGarters();
        fillHp();
      },
      do: (): void => {
        visitUrl("bigisland.php?place=camp&whichcamp=1&confirm7=1");
        visitUrl("bigisland.php?action=bossfight&pwd");
        runCombat();
        cliExecute("refresh all");
      },
      combat: new CombatStrategy().killHard().macro(Macro.trySkill($skill`Extract Jelly`)),
      limit: { tries: 1 },
      boss: true,
    },
  ],
};

export function councilSafe(): boolean {
  // Check if it is safe to visit the council without making the war outfit worse
  // (It is harder to get the hippy outfit after the war starts)
  return (
    !atLevel(12) ||
    (have($item`filthy corduroys`) && have($item`filthy knitted dread sack`)) ||
    (have($item`beer helmet`) &&
      have($item`distressed denim pants`) &&
      have($item`bejeweled pledge pin`))
  );
}

function dimesForGarters(): void {
  if (itemAmount($item`gauze garter`) >= 20) return;
  if (myTurncount() >= 1000) return;
  const to_sell = $items`pink clay bead, purple clay bead, green clay bead, communications windchimes, bullet-proof corduroys, round purple sunglasses, reinforced beaded headband`;
  for (const it of to_sell) {
    if (itemAmount(it) > 0) sell(it.buyer, itemAmount(it), it);
  }

  if ($coinmaster`Quartersmaster`.availableTokens >= 2) cliExecute("make * gauze garter");
}

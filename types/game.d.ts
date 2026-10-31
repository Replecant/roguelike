// Описания для проверки типов (tsc). На игру не влияют: здесь только то,
// что TypeScript не может вывести сам из JS-кода.

interface World {
  kind: string;                    // wild, city, dungeon
  region: string;
  city: any;                       // поселение (для карт городов)
  site: any;                       // особое место или подземелье
  lead: any;                       // событие из слухов
  depth: number;                   // уровень подземелья
  up: [number, number] | null;     // лестницы подземелья
  down: [number, number] | null;
  richSarcophagus: number;
  richVein: boolean;
  traps: Map<number, { kind: string, found: boolean }>; // ловушки (js/secrets.js)
  secrets: Set<number>;            // тайные двери
  inscriptions: Map<number, string>;
  vaultDoor: number;              // богатая жила на дне рудника
  containers: Map<number, string>; // сундуки и ящики
  work: Map<number, string>;       // клетки работы по заданиям
  placeKey: string;                // ключ места для восстановления из зерна (js/places.js)
  edits: Map<number, number>;      // клетки, изменённые после постройки
}

interface CityBuilder { pathTile: number; }

// Экраны, у которых есть оформленное HTML-окно (js/windows.js).
interface WindowScreen {
  winClass: string;
  html(): string;
  act(action: string, data: DOMStringMap, dbl?: boolean): void;
}
interface DialogScreen extends WindowScreen {}
interface ChoiceScreen extends WindowScreen {}
interface PrayerScreen extends WindowScreen {}
interface InventoryScreen extends WindowScreen {}
interface TradeScreen extends WindowScreen {}
interface JournalScreen extends WindowScreen {}
interface BestiaryScreen extends WindowScreen {}
interface CharacterScreen extends WindowScreen {}

// Портреты, встроенные в страницу при сборке в один файл.
interface Window { PORTRAITS_INLINE?: Record<string, string>; }
declare var PORTRAITS_INLINE: Record<string, string> | undefined;

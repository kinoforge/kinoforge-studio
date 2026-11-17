import { createLucideIcon, type IconNode, type LucideIcon } from "lucide-react";

type Part = string | IconNode[number];

/** Icons Lucide lacks, drawn on its 24 grid with its strokes so they sit beside its icons.
 *  A string part is a path. */
class DrawnIcon {
  static of(name: string, ...parts: Part[]): LucideIcon {
    return createLucideIcon(
      name,
      parts.map((part, index) =>
        typeof part === "string"
          ? ["path", { d: part, key: `${index}` }]
          : [part[0], { ...part[1], key: `${index}` }],
      ),
    );
  }
}

export const Bridge = DrawnIcon.of(
  "bridge",
  "M6 4v16",
  "M18 4v16",
  "M2 14h20",
  "M6 5q6 8 12 0",
  "M2 11l4-6",
  "M22 11l-4-6",
  "M9 8v6",
  "M12 9v5",
  "M15 8v6",
);

export const Crane = DrawnIcon.of(
  "crane",
  "M7 22V2",
  "M3 6h18",
  "M7 2 3 6",
  "M7 2l14 4",
  "M18 6v7",
  "M4 22h6",
  ["rect", { x: "3", y: "6", width: "3", height: "3" }],
  ["rect", { x: "15.5", y: "13", width: "5", height: "4", rx: "1" }],
);

export const Beam = DrawnIcon.of("beam", "M6 3h12v4h-3.5v10H18v4H6v-4h3.5V7H6z");

export const Truss = DrawnIcon.of("truss", "M2 7h20v10H2z", "M2 17 7 7l5 10 5-10 5 10");

export const Pump = DrawnIcon.of(
  "pump",
  ["circle", { cx: "10", cy: "13", r: "6" }],
  ["circle", { cx: "10", cy: "13", r: "1.5" }],
  "M10 7h11",
  "M21 5v4",
  "M2 13h2",
  "M2 11v4",
  "M6 21h8",
  "M7 18l-1 3",
  "M13 18l1 3",
);

export const Spring = DrawnIcon.of(
  "spring",
  "M8 2h8",
  "M8 22h8",
  "M12 2v2l5 1.5-10 3 10 3-10 3 10 3-5 1.5v3",
);

export const Lever = DrawnIcon.of(
  "lever",
  "M2 16 22 12",
  "M12 14l-4 6h8z",
  ["circle", { cx: "5", cy: "12.5", r: "2.5" }],
  "M20 3v7",
  "M18 8l2 2 2-2",
);

export const Pulley = DrawnIcon.of(
  "pulley",
  "M7 2h10",
  "M12 2v3",
  ["circle", { cx: "12", cy: "9", r: "4" }],
  ["circle", { cx: "12", cy: "9", r: "1" }],
  "M8 9v8",
  "M16 9v11",
  ["rect", { x: "5", y: "17", width: "6", height: "5", rx: "1" }],
);

export const Valve = DrawnIcon.of("valve", "M3 9v8l18-8v8z", "M12 13V5", "M8 5h8");

export const Resistor = DrawnIcon.of("resistor", "M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4");

export const Capacitor = DrawnIcon.of("capacitor", "M2 12h8", "M14 12h8", "M10 6v12", "M14 6v12");

export const Turbine = DrawnIcon.of(
  "turbine",
  ["circle", { cx: "12", cy: "9", r: "1.5" }],
  "M12 7.5V2",
  "M13.3 9.75 18 12.5",
  "M10.7 9.75 6 12.5",
  "M12 10.5V22",
  "M9 22h6",
);

export const Molecule = DrawnIcon.of(
  "molecule",
  ["circle", { cx: "12", cy: "12", r: "3" }],
  ["circle", { cx: "5", cy: "5", r: "2" }],
  ["circle", { cx: "19", cy: "6", r: "2" }],
  ["circle", { cx: "12", cy: "20", r: "2" }],
  "M9.9 9.9 6.4 6.4",
  "M14.3 10 17.5 7.3",
  "M12 15v3",
);

export const Cell = DrawnIcon.of(
  "cell",
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["circle", { cx: "13.5", cy: "10.5", r: "3" }],
  "M7 14h.01",
  "M10 18h.01",
  "M16 17h.01",
);

export const Volcano = DrawnIcon.of(
  "volcano",
  "M2 21 8 10h2.5l1.5 2 1.5-2H16l6 11z",
  "M12 8V3",
  "M9 8 7 5",
  "M15 8l2-3",
);

export const Sine = DrawnIcon.of("sine", "M2 12q2.5-8 5 0t5 0 5 0 5 0");

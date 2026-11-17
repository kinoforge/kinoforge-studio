import {
  type CardChange,
  type CastMember,
  type Move,
  OFF,
  type Pose,
  type SkitLine,
  type SkitSet,
  type Stance,
} from "./spec.ts";

export interface MemberState {
  place: Move;
  pose: Pose;
  stance: Stance;
  facing: 1 | -1;
}

export interface CardState {
  title: string;
  tags: string[];
  done: string[];
  badges: string[];
  fields: Record<string, number | string>;
}

export interface SetState {
  members: Record<string, MemberState>;
  card: CardState | null;
}

export class SkitRest {
  static pose(member: CastMember, stance: Stance): Pose {
    const working = member.desk === "laptop" || member.desk === "monitor";
    return stance === "sit" && working ? "type" : "idle";
  }
}

export class CardMemory {
  static start(set: SkitSet): CardState | null {
    if (!set.card) return null;
    return {
      title: set.card.title,
      tags: [...(set.card.tags ?? [])],
      done: [],
      badges: [],
      fields: Object.fromEntries((set.fields ?? []).map((field) => [field.id, field.value])),
    };
  }

  static apply(card: CardState, change: CardChange): CardState {
    switch (change.do) {
      case "tag":
        return card.tags.includes(change.text)
          ? card
          : { ...card, tags: [...card.tags, change.text] };
      case "tick":
        return {
          ...card,
          tags: card.tags.includes(change.text) ? card.tags : [...card.tags, change.text],
          done: card.done.includes(change.text) ? card.done : [...card.done, change.text],
        };
      case "untag":
        return {
          ...card,
          tags: card.tags.filter((tag) => tag !== change.text),
          done: card.done.filter((tag) => tag !== change.text),
        };
      case "badge":
        return card.badges.includes(change.text)
          ? card
          : { ...card, badges: [...card.badges, change.text] };
      case "set":
        return { ...card, fields: { ...card.fields, [change.field]: change.value } };
      case "title":
        return { ...card, title: change.text };
    }
  }
}

export class SkitMemory {
  static start(set: SkitSet): SetState {
    const members: Record<string, MemberState> = {};
    for (const member of set.cast) {
      members[member.id] = {
        place: member.enters ? OFF : member.place,
        pose: SkitRest.pose(member, member.stance),
        stance: member.stance,
        facing: SkitMemory.facing(member.place),
      };
    }
    return { members, card: CardMemory.start(set) };
  }

  static before(set: SkitSet, history: readonly SkitLine[], hold: boolean): SetState {
    let state = SkitMemory.start(set);
    for (const line of history) state = SkitMemory.after(set, state, line, hold);
    return state;
  }

  static after(set: SkitSet, state: SetState, line: SkitLine, hold: boolean): SetState {
    const members = { ...state.members };
    const acts = new Map((line.acts ?? []).map((act) => [act.who, act]));
    for (const member of set.cast) {
      const now = members[member.id];
      if (!now) continue;
      const act = acts.get(member.id);
      const place = act?.move ?? now.place;
      const stance = act?.move ? "stand" : now.stance;
      const spoke = line.speaker === member.id;
      const rests = spoke && (!hold || stance !== now.stance);
      const pose = act?.pose ?? (rests ? SkitRest.pose(member, stance) : now.pose);
      members[member.id] = { place, stance, pose, facing: now.facing };
    }
    for (const member of set.cast) {
      const now = members[member.id];
      if (now) members[member.id] = { ...now, facing: SkitMemory.turned(members, line, member.id) };
    }
    let card = state.card;
    if (card) {
      for (const change of line.card ?? []) card = CardMemory.apply(card, change);
      card = { ...card, badges: [] };
    }
    return { members, card };
  }

  static facing(place: Move): 1 | -1 {
    return place === "right" || place === "far_right" ? -1 : 1;
  }

  static turned(members: Record<string, MemberState>, line: SkitLine, id: string): 1 | -1 {
    const now = members[id];
    const target = id === line.speaker ? line.to : line.speaker;
    const other = target && target !== id ? members[target] : undefined;
    if (!other || other.place === OFF || now.place === OFF) return now.facing;
    const from = SkitPlaces.share(now.place);
    const to = SkitPlaces.share(other.place);
    return to === from ? now.facing : to > from ? 1 : -1;
  }
}

export class SkitPlaces {
  static readonly SHARES: Record<Exclude<Move, typeof OFF>, number> = {
    far_left: 0.13,
    left: 0.28,
    center: 0.5,
    right: 0.72,
    far_right: 0.87,
  };

  static share(place: Move): number {
    return place === OFF ? -0.2 : SkitPlaces.SHARES[place];
  }
}

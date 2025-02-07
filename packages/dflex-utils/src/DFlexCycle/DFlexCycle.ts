/* eslint-disable max-classes-per-file */

class AbstractDFlexCycle {
  /** Last known index for draggable before transitioning. */
  index: number;

  /** Transition siblings key. */
  SK: string;

  cycleID: string;

  hasScroll: boolean;

  numberOfTransformedELm: number;

  /** Defined during the transition. */
  marginBottom: number | null;

  /** Defined during the transition. */
  marginTop: number | null;

  constructor(index: number, SK: string, id: string, hasScroll: boolean) {
    this.index = index;
    this.SK = SK;
    this.cycleID = id;
    this.hasScroll = hasScroll;
    this.numberOfTransformedELm = 0;

    // TODO: Replace this with PointNum.
    this.marginBottom = null;
    this.marginTop = null;

    Object.seal(this);
  }
}

class DFlexCycle {
  private _migrations: AbstractDFlexCycle[];

  containerKeys: Set<string>;

  /** Only true when transitioning. */
  isTransitioning!: boolean;

  constructor(index: number, SK: string, id: string, hasScroll: boolean) {
    this._migrations = [new AbstractDFlexCycle(index, SK, id, hasScroll)];
    this.containerKeys = new Set([SK]);
    this.complete();
  }

  /** Get the latest migrations instance */
  latest(): AbstractDFlexCycle {
    return this._migrations[this._migrations.length - 1];
  }

  /** Get the previous migrations instance */
  prev(): AbstractDFlexCycle {
    return this._migrations[this._migrations.length - 2];
  }

  getAll(): AbstractDFlexCycle[] {
    return this._migrations;
  }

  /**
   * Get all cycles filtered by ids.
   *
   * @param cycleIDs
   * @returns
   */
  filter(cycleIDs: string[]): AbstractDFlexCycle[] {
    return this._migrations.filter((_) =>
      cycleIDs.find((i) => i === _.cycleID)
    );
  }

  flush(cycleIDs: string[]): void {
    const removedKeys = new Set<string>();

    this._migrations = this._migrations.filter((_) => {
      const shouldDelete = cycleIDs.find((id) => {
        if (id === _.SK) {
          removedKeys.add(_.SK);

          return true;
        }

        return false;
      });

      if (shouldDelete === undefined) {
        return true;
      }

      if (removedKeys.has(_.SK)) {
        removedKeys.delete(_.SK);
      }

      return false;
    });

    removedKeys.forEach((ky) => {
      this.containerKeys.delete(ky);
    });
  }

  /**
   * We only update indexes considering migration definition when it happens
   * outside container but not moving inside it.
   * So we update an index but we add key.
   *
   * @param index
   */
  setIndex(index: number): void {
    this.latest().index = index;
    this.latest().numberOfTransformedELm += 1;
  }

  preserveVerticalMargin(type: "top" | "bottom", m: number | null): void {
    this.latest()[type === "bottom" ? "marginBottom" : "marginTop"] = m;
  }

  clearMargin(): void {
    this.latest().marginBottom = null;
    this.latest().marginTop = null;
  }

  /**
   * Add new migration.
   *
   * @param index
   * @param SK
   * @param id
   * @param hasScroll
   */
  add(index: number, SK: string, id: string, hasScroll: boolean): void {
    this._migrations.push(new AbstractDFlexCycle(index, SK, id, hasScroll));
    this.containerKeys.add(SK);
  }

  /**
   * start transitioning
   */
  start(): void {
    this.isTransitioning = true;
  }

  /**
   * Get the migration done
   */
  complete(): void {
    this.isTransitioning = false;

    this.preserveVerticalMargin("top", null);
    this.preserveVerticalMargin("bottom", null);
  }

  clear(): void {
    this._migrations = [];
    this.containerKeys.clear();
  }
}

export type { AbstractDFlexCycle };
export default DFlexCycle;

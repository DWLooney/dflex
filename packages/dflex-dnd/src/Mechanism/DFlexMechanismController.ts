import { AxesPoint, PointNum, Tracker } from "@dflex/utils";

import { DFLEX_EVENTS, scheduler, store } from "../LayoutManager";
import type DraggableInteractive from "../Draggable";

import {
  APPEND_EMPTY_ELM_ID,
  handleElmMigration,
  isEmptyBranch,
} from "./DFlexPositionUpdater";
import DFlexScrollableElement from "./DFlexScrollableElement";

export function isIDEligible(elmID: string, draggedID: string): boolean {
  return (
    !!elmID &&
    elmID.length > 0 &&
    elmID !== draggedID &&
    store.has(elmID) &&
    !store.registry.get(elmID)!.readonly
  );
}

class DFlexMechanismController extends DFlexScrollableElement {
  private isOnDragOutThresholdEvtEmitted: boolean;

  /** This is only related to insert method as the each element has it's own for
   * transformation. */
  private animatedDraggedInsertionFrame: number | null;

  private _hasBeenScrolling: boolean;

  private listAppendPosition: AxesPoint | null;

  static INDEX_OUT_CONTAINER = NaN;

  /**
   * Gets the last valid element from the list which sometime can be empty
   * string if there's appending transition.
   * ["valid-id", ""] => "valid-id"
   * ["valid-id"] => "valid-id"
   */
  static getTheLastValidElm(lst: string[], draggedID: string) {
    for (let i = lst.length - 1; i >= 0; i -= 1) {
      const id = lst[i];
      if (isIDEligible(id, draggedID)) {
        return store.registry.get(id)!;
      }
    }

    throw new Error(`No valid element found.${lst}\n`);
  }

  constructor(draggable: DraggableInteractive) {
    super(draggable);

    this._hasBeenScrolling = false;
    this.isOnDragOutThresholdEvtEmitted = false;
    this.animatedDraggedInsertionFrame = null;
    this.listAppendPosition = null;
    this.isParentLocked = false;
  }

  private _detectDroppableIndex(): number | null {
    let droppableIndex = null;

    const { draggedElm } = this.draggable;

    const { SK } = store.migration.latest();

    const siblings = store.getElmBranchByKey(SK);

    for (let i = 0; i < siblings.length; i += 1) {
      const id = siblings[i];

      if (isIDEligible(id, draggedElm.id)) {
        const element = store.registry.get(id)!;

        const isQualified = element.rect.isIntersect(
          this.draggable.getAbsoluteCurrentPosition()
        );

        if (isQualified) {
          droppableIndex = i;

          break;
        }
      }
    }

    return droppableIndex;
  }

  private _detectNearestElm(): void {
    const { draggedElm, occupiedTranslate, gridPlaceholder } = this.draggable;
    const { migration } = store;

    const { SK } = migration.latest();

    const siblings = store.getElmBranchByKey(SK);
    const container = store.containers.get(SK)!;

    /**
     * If tempIndex is zero, the dragged is coming from the top. So, move them
     * down all: to=0
     */
    let hasToMoveSiblingsDown = true;

    const isEmpty = isEmptyBranch(siblings);

    let insertAt = isEmpty ? 0 : this._detectDroppableIndex();

    // Enforce attaching it from the bottom since it's already inside the container.
    if (typeof insertAt !== "number") {
      // Restore the last element position from the bottom.
      const { lastElmPosition } = container;
      if (!migration.isTransitioning && lastElmPosition) {
        this.updateDraggedThresholdPosition(
          lastElmPosition.x,
          lastElmPosition.y,
          null
        );
      }

      insertAt = siblings.length - 1;

      hasToMoveSiblingsDown = false;
    }

    this.draggable.setDraggedTempIndex(insertAt);

    this.lockParent(false);

    let draggedTransition: AxesPoint;
    let draggedGrid: PointNum;

    if (migration.isTransitioning) {
      ({ translate: draggedTransition, grid: draggedGrid } =
        this.getComposedOccupiedTranslateAndGrid(
          SK,
          insertAt,
          hasToMoveSiblingsDown,
          "y"
        ));
    }

    // If it has solo empty id then there's no need to move down. Because it's
    // empty branch.
    if (hasToMoveSiblingsDown && !isEmpty) {
      this._moveDown(insertAt);
    }

    draggedElm.removeAttribute(this.draggable.draggedDOM, "OUT_CONTAINER");

    // Clear it since it's used for insertion calculation.
    migration.clearMargin();

    if (migration.isTransitioning) {
      // Compose container boundaries and refresh the store.
      queueMicrotask(() => {
        // offset to append.
        // It has to be the biggest element offset. The last element in the list.
        const offset = {
          top: this.listAppendPosition!.y,
          right: this.listAppendPosition!.x + draggedElm.rect.width,
          bottom: this.listAppendPosition!.y + draggedElm.rect.height,
          left: this.listAppendPosition!.x,
        };

        occupiedTranslate.clone(draggedTransition);
        gridPlaceholder.clone(draggedGrid);

        let DOMGrid = draggedGrid;

        const lastElm = store.registry.get(siblings[siblings.length - 1])!;

        if (lastElm) {
          ({ DOMGrid } = lastElm);

          if (DOMGrid.y < draggedGrid.y) {
            DOMGrid = draggedGrid;
          }
        }

        handleElmMigration(SK, migration.prev().SK, offset);

        this.listAppendPosition = null;

        migration.complete();
      });
    }
  }

  private _detectNearestContainer(): void {
    const { draggedElm } = this.draggable;
    const { migration } = store;

    const { depth } = draggedElm;

    let newSK;

    const isOutInsertionArea = this.draggable.isOutThreshold(`${depth}`);

    if (isOutInsertionArea) {
      return;
    }

    const dp = store.getBranchesByDepth(depth);

    const { SK: originSK } = migration.latest();

    for (let i = 0; i < dp.length; i += 1) {
      newSK = dp[i];

      // Check if it is not the same list and if the dragged is inside new one.
      if (newSK !== originSK && !this.draggable.isOutThreshold(newSK, true)) {
        migration.start();

        const destination = store.getElmBranchByKey(newSK);

        this.listAppendPosition = this.getComposedOccupiedPosition(newSK, "y");

        const origin = store.getElmBranchByKey(originSK);

        // Remove the last element from the original list.
        // when the dragged is out of the container, the last element is the
        // placeholder as all the elements are stacked.
        origin.pop();

        this.draggable.occupiedPosition.clone(this.listAppendPosition!);

        this.draggable.gridPlaceholder.setAxes(1, 1);

        draggedElm.keys.SK = newSK;

        // Insert the element to the new list. Empty string because when dragged
        // is out the branch sets its index as "".
        destination.push(APPEND_EMPTY_ELM_ID);

        const cycleID = store.tracker.newTravel(Tracker.PREFIX_CYCLE);

        this.draggable.session.push(cycleID);

        migration.add(
          NaN,
          newSK,
          cycleID,
          store.scrolls.get(newSK)!.hasOverflow.isOneTruthy()
        );

        break;
      }
    }
  }

  private _switchElementPosition(isIncrease: boolean): void {
    const { draggedElm } = this.draggable;
    const { SK, index, cycleID } = store.migration.latest();

    const siblings = store.getElmBranchByKey(SK);

    const elmIndex = index + -1 * (isIncrease ? -1 : 1);

    const id = siblings![elmIndex];

    if (isIDEligible(id, draggedElm.id)) {
      this.draggable.setDraggedTempIndex(elmIndex);

      this.updateElement(id, siblings, cycleID, isIncrease);
    }
  }

  /**
   * Filling the space when the head of the list is leaving the list.
   */
  private _fillHeadUp(): void {
    const { occupiedPosition, draggedElm, events } = this.draggable;
    const { migration } = store;

    const { SK, index, cycleID } = migration.latest();

    const siblings = store.getElmBranchByKey(SK);

    const from = index + 1;

    if (index > 0) {
      const prevElm = store.registry.get(
        siblings[migration.latest().index - 1]
      )!;

      // Store it before lost it when the index is changed to the next one.
      migration.preserveVerticalMargin(
        "top",
        occupiedPosition.y - prevElm.rect.bottom
      );
    }

    if (from === siblings.length) {
      return;
    }

    const nextElm = store.registry.get(siblings[from])!;

    // Store it before lost it when the index is changed to the next one.
    migration.preserveVerticalMargin(
      "bottom",
      nextElm.rect.top - (occupiedPosition.y + draggedElm.rect.height)
    );

    events.dispatch(DFLEX_EVENTS.ON_LIFT_UP, {
      siblings,
      from,
      to: siblings.length,
    });

    this.draggable.setDraggedTempIndex(
      DFlexMechanismController.INDEX_OUT_CONTAINER
    );

    for (let i = from; i < siblings.length; i += 1) {
      /**
       * Don't update translate because it's not permanent. Releasing dragged
       * means undoing last position.
       */
      const id = siblings[i];

      if (isIDEligible(id, draggedElm.id)) {
        this.updateElement(id, siblings, cycleID, true);
      }
    }
  }

  /**
   *
   * @param to - index
   */
  private _moveDown(to: number): void {
    const { events, draggedElm } = this.draggable;
    const { migration } = store;

    const { SK, cycleID } = migration.latest();

    const siblings = store.getElmBranchByKey(SK);

    events.dispatch(DFLEX_EVENTS.ON_MOVE_DOWN, {
      siblings,
      from: siblings!.length - 1,
      to: siblings.length,
    });

    for (let i = siblings.length - 1; i >= to; i -= 1) {
      const id = siblings[i];

      if (isIDEligible(id, draggedElm.id)) {
        this.updateElement(id, siblings, cycleID, false);
      }
    }
  }

  private _draggedOutPositionNotifier(): void {
    const {
      draggedElm: { id },
      threshold: { isOut },
      gridPlaceholder,
    } = this.draggable;

    const { SK } = store.registry.get(id)!.keys;
    const { grid: siblingsGrid } = store.containers.get(SK)!;

    if (isOut[id].isOneTruthyByAxis("y")) {
      const newRow = isOut[id].bottom
        ? gridPlaceholder.y + 1
        : gridPlaceholder.y - 1;

      // Leaving from top.
      if (newRow === 0) {
        // lock the parent
        this.lockParent(true);

        this._fillHeadUp();

        return;
      }

      // Leaving from bottom.
      if (newRow > siblingsGrid.y) {
        // lock the parent
        this.lockParent(true);

        return;
      }

      this._switchElementPosition(isOut[id].bottom);

      return;
    }

    const newCol = isOut[id].right
      ? gridPlaceholder.x + 1
      : gridPlaceholder.x - 1;

    if (newCol <= 0 || newCol > siblingsGrid.x) {
      // lock the parent
      this.lockParent(true);

      this._fillHeadUp();

      return;
    }

    this._switchElementPosition(isOut[id].right);
  }

  private lockParent(isOut: boolean) {
    this.isParentLocked = isOut;
  }

  dragAt(x: number, y: number) {
    const { draggedElm, draggedDOM, containersTransition, scroll, events } =
      this.draggable;

    const { migration } = store;

    const { SK } = migration.latest();

    let isOutSiblingsContainer = false;

    let scrollOffsetX = 0;
    let scrollOffsetY = 0;

    if (scroll.enable) {
      this.scrollFeed(x, y);

      if (this.isScrolling()) {
        if (!this._hasBeenScrolling) {
          scheduler(store, null, {
            onUpdate: () => {
              isOutSiblingsContainer = this.draggable.isOutThreshold(SK);

              // When it's inside the container, then the siblings are not lifted
              if (!(isOutSiblingsContainer || this.isParentLocked)) {
                this.lockParent(true);

                this._fillHeadUp();
              }
            },
          });

          this._hasBeenScrolling = true;
        }

        return;
      }

      if (this._hasBeenScrolling) {
        isOutSiblingsContainer = this.draggable.isOutThreshold(SK);

        if (!isOutSiblingsContainer && this.isParentLocked) {
          scrollOffsetX =
            this.currentScrollAxes.x - this.initialScrollPosition.x;

          scrollOffsetY =
            this.currentScrollAxes.y - this.initialScrollPosition.y;

          // Update the position before calling the detector.
          this.draggable.setAbsoluteCurrentPosition(
            x + scrollOffsetX,
            y + scrollOffsetY
          );

          this._detectNearestElm();
        }

        this._hasBeenScrolling = false;

        return;
      }
    }

    scrollOffsetX = this.currentScrollAxes.x - this.initialScrollPosition.x;
    scrollOffsetY = this.currentScrollAxes.y - this.initialScrollPosition.y;

    this.draggable.dragAt(x, y, scrollOffsetX, scrollOffsetY);

    if (migration.isTransitioning) {
      return;
    }

    if (this.draggable.isOutThreshold()) {
      events.dispatch(DFLEX_EVENTS.ON_OUT_THRESHOLD, {
        id: draggedElm.id,
        index: store.migration.latest().index,
      });

      if (!this.isParentLocked) {
        draggedElm.setAttribute(draggedDOM, "OUT_POS", "true");

        this._draggedOutPositionNotifier();

        return;
      }

      draggedElm.removeAttribute(draggedDOM, "OUT_POS");

      isOutSiblingsContainer = this.draggable.isOutThreshold(SK);

      // when it's out, and on of theses is true then it's happening.
      if (!isOutSiblingsContainer) {
        if (this.animatedDraggedInsertionFrame === null) {
          this.animatedDraggedInsertionFrame = requestAnimationFrame(() => {
            this._detectNearestElm();

            this.animatedDraggedInsertionFrame = null;
          });
        }

        return;
      }

      draggedElm.setAttribute(draggedDOM, "OUT_CONTAINER", "true");

      events.dispatch(DFLEX_EVENTS.ON_OUT_CONTAINER, {
        id: draggedElm.id,
        index: store.migration.latest().index,
      });

      this.isParentLocked = true;

      if (containersTransition.enable) {
        this._detectNearestContainer();

        if (migration.isTransitioning) {
          scheduler(store, null, {
            onUpdate: () => {
              this._detectNearestElm();
            },
          });

          return;
        }
      }

      return;
    }

    if (this.isOnDragOutThresholdEvtEmitted) {
      this.isOnDragOutThresholdEvtEmitted = false;
    }

    /**
     * When dragged is out parent and returning to it.
     */
    if (this.isParentLocked) {
      isOutSiblingsContainer = this.draggable.isOutThreshold(SK);

      if (isOutSiblingsContainer) {
        return;
      }

      if (this.animatedDraggedInsertionFrame === null) {
        this.animatedDraggedInsertionFrame = requestAnimationFrame(() => {
          this._detectNearestElm();

          this.animatedDraggedInsertionFrame = null;
        });
      }
    }
  }
}

export default DFlexMechanismController;

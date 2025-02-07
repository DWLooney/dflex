import { AbstractDFlexCycle, PointNum } from "@dflex/utils";
import type { AxesPoint } from "@dflex/utils";

import { store } from "../LayoutManager";

import type { ScrollOpts, FinalDndOpts, Commit } from "../types";

import DraggableAxes from "./DraggableAxes";

class DraggableInteractive extends DraggableAxes {
  mirrorDOM: HTMLElement | null;

  scroll: ScrollOpts;

  enableCommit: Commit;

  occupiedPosition: PointNum;

  occupiedTranslate: PointNum;

  constructor(id: string, initCoordinates: AxesPoint, opts: FinalDndOpts) {
    super(id, initCoordinates, opts);

    this.mirrorDOM = null;

    this.scroll = { ...opts.scroll };

    this.enableCommit = { ...opts.commit };

    const [scroll] = store.getScrollWithSiblingsByID(id);

    const { rect, translate } = this.draggedElm;

    const { hasOverflow } = scroll;

    // Override the default options When no siblings or no overflow.
    if (hasOverflow.isAllFalsy()) {
      this.scroll.enable = false;
    }

    if (this.scroll.enable) {
      this.isViewportRestricted = false;

      // Initialize all the scroll containers in the same depth to enable migration.
      if (opts.containersTransition.enable) {
        store.getBranchesByDepth(this.draggedElm.depth).forEach((SK) => {
          store.scrolls.get(SK)!.setInnerThreshold(opts.threshold);
        });
      }

      const draggedDOM = store.interactiveDOM.get(this.draggedElm.id)!;

      this.mirrorDOM = draggedDOM.cloneNode(true) as HTMLElement;

      const initPos = this.draggedElm.getInitialPosition();

      const viewportPos = scroll.getElmPositionInViewport(initPos.y, initPos.x);

      this.setDOMAttrAndStyle(
        this.draggedDOM,
        this.mirrorDOM,
        true,
        false,
        this.draggedElm.getDimensions(draggedDOM),
        viewportPos
      );

      this.draggedDOM.parentNode!.insertBefore(this.mirrorDOM, this.draggedDOM);
      this.draggedDOM = this.mirrorDOM;
    } else {
      this.setDOMAttrAndStyle(this.draggedDOM, null, true, false, null, null);
    }

    this.occupiedPosition = new PointNum(rect.left, rect.top);
    this.occupiedTranslate = new PointNum(translate.x, translate.y);
  }

  /**
   * Update the position of the dragged element and assign the new position to
   * migration handler.
   *
   * @param index
   */
  setDraggedTempIndex(index: number) {
    if (!Number.isNaN(index)) {
      store.migration.setIndex(index);
    }

    const draggedDOM = store.interactiveDOM.get(this.draggedElm.id)!;

    this.draggedElm.setAttribute(draggedDOM, "INDEX", index);
  }

  /**
   * Handle all the instances related to dragged.
   *
   * @param isFallback
   * @param  latestCycle
   * @returns
   */
  setDraggedTransformProcess(
    isFallback: boolean,
    latestCycle: AbstractDFlexCycle
  ) {
    const { SK, index } = latestCycle;
    const { rect, translate, id, VDOMOrder, DOMGrid } = this.draggedElm;
    const siblings = store.getElmBranchByKey(SK);

    // Get the original DOM to avoid manipulating the mirror/ghost DOM.
    const draggedDOM = store.interactiveDOM.get(id)!;

    const hasToUndo =
      isFallback ||
      // dragged in position but has been clicked.
      this.occupiedPosition.isEqual(rect.left, rect.top);

    if (hasToUndo) {
      /**
       * There's a rare case where dragged leaves and returns to the same
       * position. In this case, undo won't be triggered so that we have to do
       * it manually here. Otherwise, undoing will handle repositioning. I
       * don't like it but it is what it is.
       */
      if (siblings[VDOMOrder.self] !== id) {
        this.draggedElm.assignNewPosition(siblings, VDOMOrder.self);
      }

      // If it didn't move, then do nothing.
      if (translate.isInstanceEqual(this.translatePlaceholder)) {
        return;
      }

      this.draggedElm.transform(draggedDOM);
      this.draggedElm.setAttribute(draggedDOM, "INDEX", VDOMOrder.self);

      return;
    }

    this.draggedElm.rect.setAxes(
      this.occupiedPosition.x,
      this.occupiedPosition.y
    );

    translate.clone(this.occupiedTranslate);

    DOMGrid.clone(this.gridPlaceholder);

    VDOMOrder.self = index;

    this.draggedElm.transform(draggedDOM);

    this.draggedElm.assignNewPosition(siblings, index);
  }

  /**
   *
   * @param isFallback
   * @param isMigratedInScroll
   */
  cleanup(
    isFallback: boolean,
    isMigratedInScroll: boolean,
    latestCycle: AbstractDFlexCycle
  ) {
    const draggedDOM = store.interactiveDOM.get(this.draggedElm.id)!;

    if (isMigratedInScroll) {
      this.setDOMAttrAndStyle(
        draggedDOM,
        this.mirrorDOM!,
        false,
        true,
        this.draggedElm.getDimensions(draggedDOM),
        null
      );
    } else {
      this.setDOMAttrAndStyle(
        draggedDOM,
        this.mirrorDOM!,
        false,
        false,
        null,
        null
      );
    }

    this.appendDraggedToContainerDimensions(false);
    this.setDraggedTransformProcess(isFallback, latestCycle);

    this.threshold.destroy();
  }
}

export default DraggableInteractive;

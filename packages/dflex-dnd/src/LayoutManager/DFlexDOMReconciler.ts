import type { DFlexElement, DFlexParentContainer } from "@dflex/core-instance";
import type { ELmBranch } from "@dflex/dom-gen";
import type DFlexDnDStore from "./DFlexDnDStore";

function switchElmDOMPosition(
  branchIDs: ELmBranch,
  branchDOM: HTMLElement,
  store: DFlexDnDStore,
  dflexElm: DFlexElement,
  elmDOM: HTMLElement
) {
  const VDOMIndex = dflexElm.VDOMOrder.self;
  const DOMIndex = dflexElm.DOMOrder.self;

  // Is it the last element?
  if (VDOMIndex + 1 === branchIDs.length) {
    branchDOM.appendChild(elmDOM);
  } else {
    const PevElmDOM = store.interactiveDOM.get(branchIDs[VDOMIndex + 1])!;

    branchDOM.insertBefore(elmDOM, PevElmDOM);
  }

  const shiftDirection = VDOMIndex > DOMIndex ? 1 : -1;

  for (let i = VDOMIndex - 1; i >= DOMIndex; i -= 1) {
    const dflexNextElm = store.registry.get(branchIDs[i])!;

    dflexNextElm.DOMOrder.self += shiftDirection;
  }

  dflexElm.DOMOrder.self = VDOMIndex;
}

function commitElm(
  branchIDs: ELmBranch,
  branchDOM: HTMLElement,
  store: DFlexDnDStore,
  elmID: string
): void {
  const [dflexElm, elmDOM] = store.getElmWithDOM(elmID);

  if (dflexElm.hasTransformedFromOrigin()) {
    if (dflexElm.needReconciliation()) {
      switchElmDOMPosition(branchIDs, branchDOM, store, dflexElm, elmDOM);
    }

    dflexElm.flushIndicators(elmDOM);
  }
}

/**
 *
 * @param branchIDs
 * @param branchDOM
 * @param store
 * @param container
 * @returns
 */
function DFlexDOMReconciler(
  branchIDs: ELmBranch,
  branchDOM: HTMLElement,
  store: DFlexDnDStore,
  container: DFlexParentContainer
): void {
  container.resetIndicators(branchIDs.length);

  for (let i = branchIDs.length - 1; i >= 0; i -= 1) {
    commitElm(branchIDs, branchDOM, store, branchIDs[i]);
  }

  // TODO:
  // This can be optimized, like targeting only the effected element. But I
  // don't want to play with grid since it's not fully implemented.
  for (let i = 0; i <= branchIDs.length - 1; i += 1) {
    const dflexElm = store.registry.get(branchIDs[i])!;

    store.setElmGridBridge(container, dflexElm);

    if (__DEV__) {
      if (
        i !== dflexElm.DOMOrder.self ||
        dflexElm.DOMOrder.self !== dflexElm.VDOMOrder.self
      ) {
        // eslint-disable-next-line no-console
        console.error(
          `Error in DOM order reconciliation.\n id: ${dflexElm.id}. Expected DOM order: ${dflexElm.DOMOrder.self} to match VDOM order: ${dflexElm.VDOMOrder.self}`
        );
      }

      if (
        !branchDOM.children[i].isSameNode(
          store.interactiveDOM.get(branchIDs[i])!
        )
      ) {
        // eslint-disable-next-line no-console
        console.error(
          `Error in DOM order reconciliation.\n. ${
            branchDOM.children[i]
          } doesn't match ${store.interactiveDOM.get(branchIDs[i])!}`
        );
      }
    }
  }
}

export default DFlexDOMReconciler;

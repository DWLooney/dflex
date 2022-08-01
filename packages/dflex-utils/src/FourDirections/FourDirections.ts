import type { Axis, Direction } from "../types";

type GetAllOutput<T> = {
  up: T;
  right: T;
  bottom: T;
  left: T;
};

/** Four direction instance - clockwise */
class FourDirections<T> {
  top!: T;

  right!: T;

  bottom!: T;

  left!: T;

  constructor(top: T, right: T, bottom: T, left: T) {
    this.setAll(top, right, bottom, left);
    Object.seal(this);
  }

  /**
   * Set all directions.
   *
   * @param top
   * @param right
   * @param bottom
   * @param left
   */
  setAll(top: T, right: T, bottom: T, left: T): void {
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }

  /**
   * Get an instance of FourDirections.
   *
   * @returns
   */
  getAll(): GetAllOutput<T> {
    return {
      up: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
    };
  }

  /**
   * Set one axis only.
   *
   * @param axis
   * @param x
   * @param y
   */
  setByAxis(axis: Axis, x: T, y: T): void {
    switch (axis) {
      case "x":
        this.left = x;
        this.right = y;
        break;
      default:
        this.top = x;
        this.bottom = y;
        break;
    }
  }

  /**
   * Set one direction only.
   *
   * @param axis
   * @param direction
   * @param value
   */
  setOne(axis: Axis, direction: Direction, value: T): void {
    switch (axis) {
      case "x":
        if (direction === -1) {
          this.left = value;
        } else {
          this.right = value;
        }
        break;
      default:
        if (direction === -1) {
          this.top = value;
        } else {
          this.bottom = value;
        }
        break;
    }
  }

  /**
   * Get the value of one direction.
   *
   * @param axis
   * @param direction
   * @returns
   */
  getOne(axis: Axis, direction: Direction): T {
    switch (axis) {
      case "x":
        return direction === -1 ? this.left : this.right;
      default:
        return direction === -1 ? this.top : this.bottom;
    }
  }
}

export default FourDirections;

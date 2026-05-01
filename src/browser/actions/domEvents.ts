const CLICK_TYPES = [
  "pointerover",
  "pointerenter",
  "mouseover",
  "mouseenter",
  "pointermove",
  "mousemove",
  "pointerdown",
  "mousedown",
  "pointerup",
  "mouseup",
  "click",
] as const;

export function buildClickDispatcher(functionName = "dispatchClickSequence"): string {
  const typesLiteral = JSON.stringify(CLICK_TYPES);
  return `function ${functionName}(target){
    if(!target || !(target instanceof EventTarget)) return false;
    const types = ${typesLiteral};
    for (const type of types) {
      const common = { bubbles: true, cancelable: true, view: window };
      let event;
      if (type.startsWith('pointer') && 'PointerEvent' in window) {
        event = new PointerEvent(type, { ...common, pointerId: 1, pointerType: 'mouse' });
      } else {
        event = new MouseEvent(type, common);
      }
      target.dispatchEvent(event);
    }
    return true;
  }`;
}

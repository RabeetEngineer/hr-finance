export const RESOURCE_CHANGED_EVENT = "hrf:resource-changed";

export const notifyResourceChanged = (resource) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED_EVENT, { detail: { resource } }));
};

export const subscribeResourceChanged = (handler) => {
  if (typeof window === "undefined") return () => {};

  const listener = (event) => handler(event.detail);
  window.addEventListener(RESOURCE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(RESOURCE_CHANGED_EVENT, listener);
};

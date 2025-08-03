// Send the image URL and any other needed data to the page context
const imgUrl = chrome.runtime.getURL("icons/BES48.png");

window.postMessage(
  {
    source: "ETA_EXTENSION_BRIDGE",
    type: "ASSET_URLS",
    payload: {
      besIcon: imgUrl
    }
  },
  "*" // page can filter origin if desired
);

export default defineComponent({
  key: "tiktok_live-check_alive",
  name: "TikTok LIVE - Check Alive",
  description: "Check whether a TikTok creator is currently live. Uses the TikTok LIVE API (https://api.tik.tools). Get a free key at https://tik.tools/pricing.",
  version: "0.0.1",
  type: "action",
  props: {
    tiktoolsApiKey: {
      type: "string",
      secret: true,
      label: "TikTok LIVE API Key",
      description: "Your TikTok LIVE API key. Sent as the x-api-key header. Grab a free key at https://tik.tools/pricing.",
    },
    uniqueId: {
      type: "string",
      label: "Creator username",
      description: "The TikTok unique_id (handle) to check, without the leading @. Example: tiktok.",
    },
  },
  async run({ steps, $ }) {
    const handle = String(this.uniqueId || "").trim().replace(/^@/, "");
    if (!handle) {
      throw new Error("A creator username is required.");
    }

    const url = new URL("https://api.tik.tools/webcast/check_alive");
    url.searchParams.set("unique_id", handle);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": this.tiktoolsApiKey,
        accept: "application/json",
      },
    });

    const bodyText = await res.text();
    let data;
    try {
      data = bodyText ? JSON.parse(bodyText) : {};
    } catch (err) {
      data = { raw: bodyText };
    }

    if (!res.ok) {
      throw new Error(
        "TikTok LIVE API request failed with status " + res.status + ": " + bodyText
      );
    }

    $.export("$summary", "Checked live status for " + handle);
    return data;
  },
});

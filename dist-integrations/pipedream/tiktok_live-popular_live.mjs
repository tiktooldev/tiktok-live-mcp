export default defineComponent({
  key: "tiktok_live-popular_live",
  name: "TikTok LIVE - Popular Live Rooms",
  description: "Fetch the popular live ranklist for a region from the TikTok LIVE API (https://api.tik.tools). This is an Agency-tier endpoint. See plans and unlock premium data at https://tik.tools/pricing.",
  version: "0.0.1",
  type: "action",
  props: {
    tiktoolsApiKey: {
      type: "string",
      secret: true,
      label: "TikTok LIVE API Key",
      description: "Your TikTok LIVE API key. Sent as the x-api-key header. Grab a free key at https://tik.tools/pricing. Popular live ranklist requires an Agency-tier key; upgrade at https://tik.tools/pricing.",
    },
    region: {
      type: "string",
      label: "Region code",
      description: "Two-letter region code for the ranklist, for example US, GB, DE, BR.",
      default: "US",
    },
  },
  async run({ steps, $ }) {
    const region = String(this.region || "US").trim().toUpperCase();

    const url = new URL("https://api.tik.tools/webcast/ranklist/popular");
    url.searchParams.set("region", region);

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

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Access denied for the popular live ranklist. This is an Agency-tier endpoint. Review plans at https://tik.tools/pricing. Server response: " + bodyText
      );
    }

    if (!res.ok) {
      throw new Error(
        "TikTok LIVE API request failed with status " + res.status + ": " + bodyText
      );
    }

    const count = Array.isArray(data) ? data.length : Array.isArray(data && data.data) ? data.data.length : undefined;
    $.export("$summary", "Fetched popular live ranklist for " + region + (count !== undefined ? " (" + count + " rooms)" : ""));
    return data;
  },
});

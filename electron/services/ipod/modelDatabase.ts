type ModelInfo = {
  name: string;
  generation: string;
  family: "classic" | "mini" | "nano" | "shuffle" | "touch" | "video";
};

/**
 * Maps the ModelNumStr value (with leading M/P stripped) from SysInfo
 * to human-readable device information. This list covers the most common
 * iPod models that support USB mass storage / disk mode.
 *
 * Sources: Apple Support HT204217, ipodlinux.org, everymac.com
 */
const MODEL_DB: Record<string, ModelInfo> = {
  // iPod Classic
  "A623": { name: "iPod Classic 6G 80GB", generation: "6th", family: "classic" },
  "A726": { name: "iPod Classic 6G 160GB", generation: "6th", family: "classic" },
  "B029": { name: "iPod Classic 6G 120GB", generation: "6.5th", family: "classic" },
  "B147": { name: "iPod Classic 7G 160GB (Late 2009)", generation: "7th", family: "classic" },
  "C293": { name: "iPod Classic 7G 160GB", generation: "7th", family: "classic" },
  "C297": { name: "iPod Classic 7G 160GB", generation: "7th", family: "classic" },

  // iPod Video (5G / 5.5G)
  "A002": { name: "iPod Video 5G 30GB White", generation: "5th", family: "video" },
  "A003": { name: "iPod Video 5G 60GB White", generation: "5th", family: "video" },
  "A146": { name: "iPod Video 5G 30GB Black", generation: "5th", family: "video" },
  "A147": { name: "iPod Video 5G 60GB Black", generation: "5th", family: "video" },
  "A444": { name: "iPod Video 5.5G 30GB", generation: "5.5th", family: "video" },
  "A446": { name: "iPod Video 5.5G 80GB", generation: "5.5th", family: "video" },
  "A448": { name: "iPod Video 5.5G 30GB Black", generation: "5.5th", family: "video" },
  "A450": { name: "iPod Video 5.5G 80GB Black", generation: "5.5th", family: "video" },

  // iPod 4G (Click Wheel)
  "9282": { name: "iPod 4G 20GB", generation: "4th", family: "classic" },
  "9268": { name: "iPod 4G 40GB", generation: "4th", family: "classic" },
  "A079": { name: "iPod Photo 20GB", generation: "4th", family: "classic" },
  "9829": { name: "iPod Photo 30GB", generation: "4th", family: "classic" },
  "9585": { name: "iPod Photo 40GB", generation: "4th", family: "classic" },
  "9586": { name: "iPod Photo 60GB", generation: "4th", family: "classic" },
  "9830": { name: "iPod Photo 60GB", generation: "4th", family: "classic" },

  // iPod 3G
  "8976": { name: "iPod 3G 10GB", generation: "3rd", family: "classic" },
  "8946": { name: "iPod 3G 15GB", generation: "3rd", family: "classic" },
  "9244": { name: "iPod 3G 20GB", generation: "3rd", family: "classic" },
  "8948": { name: "iPod 3G 30GB", generation: "3rd", family: "classic" },
  "9245": { name: "iPod 3G 40GB", generation: "3rd", family: "classic" },

  // iPod Mini
  "9160": { name: "iPod Mini 1G 4GB Silver", generation: "1st", family: "mini" },
  "9436": { name: "iPod Mini 1G 4GB Blue", generation: "1st", family: "mini" },
  "9435": { name: "iPod Mini 1G 4GB Pink", generation: "1st", family: "mini" },
  "9434": { name: "iPod Mini 1G 4GB Green", generation: "1st", family: "mini" },
  "9800": { name: "iPod Mini 2G 4GB Silver", generation: "2nd", family: "mini" },
  "9801": { name: "iPod Mini 2G 6GB Silver", generation: "2nd", family: "mini" },
  "9802": { name: "iPod Mini 2G 4GB Blue", generation: "2nd", family: "mini" },
  "9804": { name: "iPod Mini 2G 4GB Pink", generation: "2nd", family: "mini" },

  // iPod Nano
  "A350": { name: "iPod Nano 1G 1GB White", generation: "1st", family: "nano" },
  "A352": { name: "iPod Nano 1G 1GB Black", generation: "1st", family: "nano" },
  "A004": { name: "iPod Nano 1G 2GB White", generation: "1st", family: "nano" },
  "A099": { name: "iPod Nano 1G 2GB Black", generation: "1st", family: "nano" },
  "A005": { name: "iPod Nano 1G 4GB White", generation: "1st", family: "nano" },
  "A107": { name: "iPod Nano 1G 4GB Black", generation: "1st", family: "nano" },
  "A477": { name: "iPod Nano 2G 2GB Silver", generation: "2nd", family: "nano" },
  "A426": { name: "iPod Nano 2G 4GB Silver", generation: "2nd", family: "nano" },
  "A497": { name: "iPod Nano 2G 8GB Black", generation: "2nd", family: "nano" },
  "B261": { name: "iPod Nano 3G 4GB Silver", generation: "3rd", family: "nano" },
  "B598": { name: "iPod Nano 4G 8GB Silver", generation: "4th", family: "nano" },
  "B903": { name: "iPod Nano 5G 8GB Silver", generation: "5th", family: "nano" },

  // iPod Shuffle
  "9724": { name: "iPod Shuffle 1G 512MB", generation: "1st", family: "shuffle" },
  "9725": { name: "iPod Shuffle 1G 1GB", generation: "1st", family: "shuffle" },
  "A564": { name: "iPod Shuffle 2G 1GB Silver", generation: "2nd", family: "shuffle" },
  "B225": { name: "iPod Shuffle 3G 4GB Silver", generation: "3rd", family: "shuffle" },
  "C164": { name: "iPod Shuffle 4G 2GB Silver", generation: "4th", family: "shuffle" }
};

export function lookupModel(modelNumStr: string): ModelInfo {
  const stripped = modelNumStr.replace(/^[MP]/i, "");
  const info = MODEL_DB[stripped];
  if (info) return info;
  return { name: `Unknown iPod (model: ${modelNumStr})`, generation: "unknown", family: "classic" };
}

export type { ModelInfo };

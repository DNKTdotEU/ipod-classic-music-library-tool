export type RuleProfile = {
  id: string;
  name: string;
  preferredFormats: string[];
  askOnConflict: boolean;
  durationThresholdSec: number;
};

const defaultProfile: RuleProfile = {
  id: "default",
  name: "Balanced iPod",
  preferredFormats: ["mp3", "aac", "alac", "flac"],
  askOnConflict: true,
  durationThresholdSec: 2
};

export class RulesService {
  getProfiles(): RuleProfile[] {
    return [defaultProfile];
  }
}

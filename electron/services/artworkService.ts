export type ArtworkCandidate = {
  url: string;
  width: number;
  height: number;
  type: "front" | "back" | "other";
};

export class ArtworkService {
  async search(album: string, artist: string): Promise<ArtworkCandidate[]> {
    const base = `https://coverartarchive.org/release-group/demo?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`;
    return [
      { url: `${base}&img=1`, width: 1000, height: 1000, type: "front" },
      { url: `${base}&img=2`, width: 600, height: 600, type: "other" }
    ];
  }
}

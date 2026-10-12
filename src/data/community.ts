// Mountains shared by players. A shared link ends in "#mountain=<code>"; when one arrives by email and the
// builder agrees to be named, add it here and it appears under "From players" in the mountain builder.
// Example: { name: 'Glacier fork', by: 'Ana, Berlin', code: '1.0.0_1.1.0_2.0.-1' }

export interface CommunityMountain {
  name: string;
  by: string;
  code: string; // the part after "#mountain=" in the shared link
  blurb?: string;
}

export const community: CommunityMountain[] = [];

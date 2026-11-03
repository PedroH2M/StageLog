import {
  Award,
  Compass,
  Crown,
  Disc,
  Flame,
  Headphones,
  Heart,
  History,
  Layers,
  Music,
  Sparkles,
  Tent,
  Ticket,
  Zap,
} from 'lucide-react';

interface BadgeIconProps {
  iconKey: string;
  size?: number;
}

export function BadgeIcon({ iconKey, size = 20 }: BadgeIconProps) {
  const sw = 1.65;
  switch (iconKey) {
    case 'ticket':
      return <Ticket size={size} strokeWidth={sw} />;
    case 'flame':
      return <Flame size={size} strokeWidth={sw} />;
    case 'crown':
      return <Crown size={size} strokeWidth={sw} />;
    case 'heart':
      return <Heart size={size} strokeWidth={sw} />;
    case 'sparkles':
      return <Sparkles size={size} strokeWidth={sw} />;
    case 'music':
      return <Music size={size} strokeWidth={sw} />;
    case 'zap':
      return <Zap size={size} strokeWidth={sw} />;
    case 'disc':
      return <Disc size={size} strokeWidth={sw} />;
    case 'headphones':
      return <Headphones size={size} strokeWidth={sw} />;
    case 'award':
      return <Award size={size} strokeWidth={sw} />;
    case 'tent':
      return <Tent size={size} strokeWidth={sw} />;
    case 'layers':
      return <Layers size={size} strokeWidth={sw} />;
    case 'history':
      return <History size={size} strokeWidth={sw} />;
    case 'compass':
      return <Compass size={size} strokeWidth={sw} />;
    default:
      return <Award size={size} strokeWidth={sw} />;
  }
}

import { GeneratedAvatar } from '../common/GeneratedAvatar';
import { useProfileStore } from '../../stores/profileStore';

interface AvatarProps {
  name: string;
  size?: number;
  /** Só necessário se quiseres mostrar o avatar de OUTRO utilizador que não
   * o da sessão atual (ex.: pré-visualização no seletor). Por omissão usa o
   * avatar_style do utilizador com sessão iniciada. */
  avatarStyle?: string | null;
}

// Antes: círculo sólido com a primeira letra do nome, sempre. Agora delega
// em GeneratedAvatar, que sabe desenhar tanto o avatar de iniciais como os
// avatares 2D pré-definidos escolhidos no Onboarding/Perfil — mantendo a
// mesma API (`<Avatar name={...} size={...} />`) para não obrigar a mexer
// em todos os sítios que já usam este componente.
export function Avatar({ name, size = 36, avatarStyle }: AvatarProps) {
  const profileAvatarStyle = useProfileStore((s) => s.avatar_style);
  return <GeneratedAvatar name={name} size={size} avatarStyle={avatarStyle ?? profileAvatarStyle} />;
}

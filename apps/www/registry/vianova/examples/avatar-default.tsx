import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/registry/vianova/ui/avatar";

export default function AvatarDefault() {
  return (
    <div className="flex items-center gap-6">
      <Avatar>
        <AvatarImage src="/avatar.png" alt="" />
        <AvatarFallback>MG</AvatarFallback>
      </Avatar>
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>MG</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>LH</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>PA</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+4</AvatarGroupCount>
      </AvatarGroup>
    </div>
  );
}

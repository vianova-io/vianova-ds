import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/registry/vianova/ui/avatar";

/**
 * Served from the app's own `public/`, so it carries the app's basePath --
 * `basePath` does not rewrite a raw `src` string. Unset in a root-served app,
 * which is what installing this gives you, so it resolves to "/avatar.png".
 */
/**
 * Declared locally so this file compiles in a project without @types/node.
 *
 * The repo's registry smoke test installs these components into a bare TS
 * project and typechecks them, and it caught a bare `process` reference here:
 * a consumer who has not installed node types gets TS2580 the moment they add
 * this block. The expression still has to read `process.env.NEXT_PUBLIC_BASE_PATH`
 * VERBATIM, because Next substitutes that exact text at build time -- routing
 * it through globalThis or an optional chain silently defeats the inlining and
 * leaves the prefix empty.
 */
declare const process: { env: Record<string, string | undefined> };

const AVATAR_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/avatar.png`;

export default function AvatarDefault() {
  return (
    <div className="flex items-center gap-6">
      <Avatar>
        <AvatarImage src={AVATAR_SRC} alt="" />
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

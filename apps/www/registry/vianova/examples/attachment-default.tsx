import { FileText } from "lucide-react";

import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/registry/vianova/ui/attachment";

export default function AttachmentDefault() {
  return (
    <AttachmentGroup className="w-full">
      <Attachment>
        <AttachmentMedia>
          <FileText />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>le-havre-od.csv</AttachmentTitle>
          <AttachmentDescription>1.2 MB</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </AttachmentGroup>
  );
}

import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from "@/registry/vianova/ui/message";

export default function MessageDefault() {
  return (
    <MessageGroup className="w-full">
      <Message>
        <MessageAvatar />
        <MessageContent>
          Which districts saw the largest increase in bike trips last month?
        </MessageContent>
      </Message>
      <Message>
        <MessageAvatar />
        <MessageContent>
          Port district grew 21% and City centre 14%, both driven by weekday mornings.
        </MessageContent>
      </Message>
    </MessageGroup>
  );
}

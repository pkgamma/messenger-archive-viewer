/* eslint-disable @next/next/no-img-element */
import cx from 'clsx';
import { Popover } from 'react-tiny-popover';
import { SRLWrapper } from 'simple-react-lightbox';
import useSWR from 'swr';

import useToggle from '@/lib/hooks/useToggle';
import { getFileHandleRecursively } from '@/lib/utils/file';
import { decodeString, useGroupedActorsByReaction } from '@/lib/utils/message';

import FsImage from './FsImage';
import { Message, MessageType } from '../types';

function ReactionButton({
  reaction,
  actors,
}: {
  reaction: string;
  actors: string[];
}) {
  const [isPopoverOpen, setPopoverOpen, togglePopover] = useToggle(false);

  return (
    <Popover
      isOpen={isPopoverOpen}
      positions={['top']}
      padding={10}
      content={() => (
        <div className='rounded bg-gray-600 py-0.5 px-1 text-white'>
          {actors.map(decodeString).join(', ')}
        </div>
      )}
      onClickOutside={() => setPopoverOpen(false)}
    >
      <span onClick={togglePopover}>{decodeString(reaction)}</span>
    </Popover>
  );
}

function BaseMessage({
  children,
  isFirst,
  isLast,
  isMe,
  className,
  message,
  transparentBG,
}: {
  message: Message;
  children?: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  isMe: boolean;
  className?: string;
  transparentBG?: boolean;
}) {
  const [isPopoverOpen, setPopoverOpen, togglePopover] = useToggle(false);
  const groupedActions = useGroupedActorsByReaction(message);

  return (
    <div
      className={cx('flex', {
        'justify-end': isMe,
      })}
    >
      <Popover
        isOpen={isPopoverOpen}
        positions={['left']}
        padding={10}
        content={() => (
          <div className='rounded bg-gray-600 py-0.5 px-1 text-white'>
            {new Date(message.timestamp_ms).toLocaleString()}
          </div>
        )}
        onClickOutside={() => setPopoverOpen(false)}
      >
        <div
          className={cx(
            'relative whitespace-pre-wrap rounded-2xl px-4 py-2',
            {
              'rounded-r-md  text-white ': isMe,
              'bg-blue-400 dark:bg-blue-700': isMe && !transparentBG,
              'rounded-l-md dark:bg-slate-800': !isMe,
              'bg-gray-200': !isMe && !transparentBG,
              'rounded-tl-2xl': isFirst && !isMe,
              'rounded-bl-2xl': isLast && !isMe,
              'rounded-tr-2xl': isFirst && isMe,
              'rounded-br-2xl': isLast && isMe,
              'bg-transparent dark:bg-transparent': transparentBG,
            },
            className
          )}
          onClick={() => {
            togglePopover();
          }}
        >
          {children}

          {groupedActions && (
            <div className='absolute right-2 -bottom-5 select-none rounded-2xl bg-white px-2 py-0.5 shadow dark:bg-slate-800'>
              {Object.entries(groupedActions).map(([reaction, actors]) => (
                <ReactionButton
                  key={reaction}
                  reaction={reaction}
                  actors={actors}
                />
              ))}
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}

export default function MessageComponent({
  message,
  isFirst,
  isLast,
  isMe,
  rootDir,
}: {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  isMe: boolean;
  rootDir: FileSystemDirectoryHandle;
}) {
  const content = decodeString(message.content || '');
  const { data: imageURIs } = useSWR(
    () =>
      message.type === MessageType.Generic && message.photos
        ? `/message/photo/${message.timestamp_ms}`
        : null,
    async () => {
      if (!(message.type === MessageType.Generic && message.photos)) {
        return [];
      }

      const images = await Promise.all(
        message.photos.map(async (photo) => {
          const uri = photo.uri.replace(/^messages\//, '');
          const fileHandle = await getFileHandleRecursively(rootDir, uri);
          if (!fileHandle) {
            return null;
          }
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          return url;
        })
      );

      return images.filter(Boolean) as string[];
    }
  );

  const renderDefault = () => (
    <BaseMessage
      isFirst={isFirst}
      isLast={isLast}
      isMe={isMe}
      message={message}
    >
      {content}
    </BaseMessage>
  );

  const renderNotImplemented = () => (
    <BaseMessage
      isFirst={isFirst}
      isLast={isLast}
      isMe={isMe}
      className='bg-red-500 text-white dark:bg-red-700'
      message={message}
    >
      Not implemented
      <pre className='mt-3 whitespace-pre-wrap text-xs'>
        <code>{JSON.stringify(message)}</code>
      </pre>
    </BaseMessage>
  );

  switch (message.type) {
    case MessageType.Generic: {
      if (message.photos) {
        return (
          <SRLWrapper>
            <BaseMessage
              isFirst={isFirst}
              isLast={isLast}
              isMe={isMe}
              message={message}
            >
              {imageURIs
                ? imageURIs.map((uri) => (
                    <a href={uri} key={uri}>
                      <img src={uri} alt={uri} />
                    </a>
                  ))
                : content}
            </BaseMessage>
          </SRLWrapper>
        );
      } else if (message.content) {
        return renderDefault();
      } else if (message.sticker) {
        return (
          <BaseMessage
            isFirst={isFirst}
            isLast={isLast}
            isMe={isMe}
            message={message}
            transparentBG
          >
            <FsImage
              root={rootDir}
              path={message.sticker.uri.replace(/^messages\//, '')}
            />
          </BaseMessage>
        );
      } else {
        return renderDefault();
      }
    }
    case MessageType.Share: {
      if (message.share?.link) {
        return (
          <BaseMessage
            isFirst={isFirst}
            isLast={isLast}
            isMe={isMe}
            message={message}
          >
            <a
              href={message.share.link}
              target='_blank'
              rel='noreferrer'
              className='underline'
            >
              {content}
            </a>
          </BaseMessage>
        );
      } else {
        return renderDefault();
      }
    }
    default:
      // return renderNotImplemented();
      return renderDefault();
  }
}

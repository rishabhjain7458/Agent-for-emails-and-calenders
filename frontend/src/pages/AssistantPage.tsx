import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { AxiosError } from 'axios';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/Event';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { chat, getAssistantConversation, getAssistantConversations } from '../api/endpoints';
import { useSpace } from '../contexts/SpaceContext';
import type { AssistantConversation } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function cleanAssistantText(content: string) {
  return readableAssistantText(content)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .trim();
}

function readableAssistantText(content: string) {
  const trimmed = content.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return content;

  try {
    const parsed = JSON.parse(trimmed);
    const event = parsed?.event ?? parsed;
    if (event?.kind === 'calendar#event' || event?.htmlLink || event?.summary) {
      return [
        event.status === 'confirmed' ? 'Meeting created.' : 'Calendar result.',
        '',
        event.summary ? `Title: ${event.summary}` : '',
        event.start?.dateTime || event.start?.date ? `Starts: ${formatDisplayDate(event.start.dateTime ?? event.start.date)}` : '',
        event.end?.dateTime || event.end?.date ? `Ends: ${formatDisplayDate(event.end.dateTime ?? event.end.date)}` : '',
        event.description ? `Notes: ${event.description}` : '',
        event.htmlLink ? `Calendar link: ${event.htmlLink}` : ''
      ].filter(Boolean).join('\n');
    }

    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => `${index + 1}. ${item.title ?? item.subject ?? item.summary ?? JSON.stringify(item)}`).join('\n');
    }
  } catch {
    return content;
  }

  return content;
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function renderInlineText(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return <Fragment key={index}>{part}</Fragment>;
    return (
      <Box key={index} component="a" href={part} target="_blank" rel="noreferrer" sx={{ color: 'primary.main', fontWeight: 700, wordBreak: 'break-all' }}>
        Open link
      </Box>
    );
  });
}

function labelValue(lines: string[], label: string) {
  return lines.find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))?.replace(/^[^:]+:\s*/, '');
}

function collectSection(lines: string[], title: string) {
  const start = lines.findIndex((line) => line.toLowerCase() === `${title.toLowerCase()}:`);
  if (start < 0) return [];
  const next = lines.findIndex((line, index) => index > start && /^[A-Z][A-Za-z0-9 ]+:$/.test(line));
  return lines.slice(start + 1, next < 0 ? undefined : next).filter(Boolean);
}

function parseNumberedBlocks(lines: string[], prefix: string) {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (new RegExp(`^${prefix} \\d+:$`, 'i').test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function KeyValueGrid({ rows }: { rows: [string, string | undefined][] }) {
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (!visible.length) return null;
  return (
    <Grid container spacing={1}>
      {visible.map(([label, value]) => (
        <Grid key={label} item xs={12} sm={6}>
          <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850 }}>{label}</Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.45, overflowWrap: 'anywhere' }}>{renderInlineText(value)}</Typography>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

function AssistantStructuredCard({ cleaned }: { cleaned: string }) {
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? '';
  const isMeeting = /meeting created|calendar result|calendar conflict/i.test(first);
  const isAgenda = /calendar agenda/i.test(first) || lines.includes('Events:');
  const isEmail = /^found \d+ emails?/i.test(first) || /email summary/i.test(first) || lines.includes('Emails');
  const isTask = /task created|tasks?|pending/i.test(first) && lines.some((line) => /task|pending|completed|due/i.test(line));

  if (!isMeeting && !isAgenda && !isEmail && !isTask) return null;

  const icon = isMeeting || isAgenda ? <EventIcon /> : isEmail ? <MailOutlineIcon /> : <CheckCircleIcon />;
  const title = isMeeting ? first : isAgenda ? 'Calendar agenda' : isEmail ? first : first === 'Task created' ? 'Task created' : 'Tasks';
  const actionHref = isMeeting || isAgenda ? '/calendar' : isEmail ? '/emails' : '/tasks';
  const calendarLink = labelValue(lines, 'Calendar link');
  const eventBlocks = parseNumberedBlocks(lines, 'Event');
  const emailBlocks = parseNumberedBlocks(lines, 'Email');
  const rows = isMeeting || isTask
    ? [
      ['Title', labelValue(lines, 'Title')],
      ['When', labelValue(lines, 'When') ?? labelValue(lines, 'Starts')],
      ['Attendees', labelValue(lines, 'Attendees')],
      ['Due', labelValue(lines, 'Due')],
      ['Status', labelValue(lines, 'Status')],
      ['Notes', labelValue(lines, 'Notes')]
    ].filter((row) => row[1])
    : lines
      .filter((line) => !/^(email|event) \d+:$/i.test(line) && !/^(emails|events|available accounts)$/i.test(line) && line !== first)
      .slice(0, 8)
      .map((line) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        return match ? [match[1], match[2]] : ['', line];
      });

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper', boxShadow: 'none', minWidth: { xs: 0, sm: 430 } }}>
      <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5 } } }}>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: isMeeting || isAgenda ? 'secondary.light' : 'primary.light', color: isMeeting || isAgenda ? 'secondary.dark' : 'primary.dark' }}>
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{title}</Typography>
              {(isEmail || isAgenda) && <Typography variant="caption" color="text.secondary">{labelValue(lines, 'Found') ?? labelValue(lines, 'Status') ?? 'Formatted result'}</Typography>}
            </Box>
          </Stack>
          {(isMeeting || isTask) && <KeyValueGrid rows={rows as [string, string | undefined][]} />}
          {isAgenda && (
            <Stack spacing={1}>
              <KeyValueGrid rows={[['Range', labelValue(lines, 'Range')], ['Found', labelValue(lines, 'Found')], ['Status', labelValue(lines, 'Status')]]} />
              {eventBlocks.slice(0, 8).map((block, index) => (
                <Box key={index} sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1.35 }}>{labelValue(block, 'Title') ?? `Event ${index + 1}`}</Typography>
                  <Typography variant="body2" color="text.secondary">{labelValue(block, 'When')}</Typography>
                  {labelValue(block, 'Calendar') && <Typography variant="caption" color="text.secondary">{labelValue(block, 'Calendar')}</Typography>}
                </Box>
              ))}
            </Stack>
          )}
          {isEmail && !isMeeting && !isTask && (
            <Stack spacing={1}>
              <KeyValueGrid rows={[['Overview', labelValue(lines, 'Overview')], ['Search', labelValue(lines, 'Search used')], ['Status', labelValue(lines, 'Status')]]} />
              {emailBlocks.slice(0, 5).map((block, index) => (
                <Box key={index} sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1.35 }}>{labelValue(block, 'Subject') ?? `Email ${index + 1}`}</Typography>
                  <Typography variant="body2" color="text.secondary">{labelValue(block, 'From')}</Typography>
                  <Typography variant="caption" color="text.secondary">{labelValue(block, 'Date')}</Typography>
                  {labelValue(block, 'Preview') && <Typography variant="body2" sx={{ mt: 0.6 }}>{labelValue(block, 'Preview')}</Typography>}
                </Box>
              ))}
              {['Priority items', 'Other notes', 'Next steps', 'What I checked'].map((section) => {
                const items = collectSection(lines, section);
                if (!items.length) return null;
                return (
                  <Box key={section} sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>{section}</Typography>
                    <Stack component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }} spacing={0.45}>
                      {items.map((item, index) => <Typography key={index} component="li" variant="body2">{renderInlineText(item.replace(/^-\s*/, ''))}</Typography>)}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="contained" href={actionHref} endIcon={<OpenInNewIcon />}>
              Open {isMeeting || isAgenda ? 'calendar' : isEmail ? 'emails' : 'tasks'}
            </Button>
            {(isMeeting || isAgenda) && (
              <Button size="small" variant="outlined" href="/calendar">
                Add to calendar
              </Button>
            )}
            {isEmail && (
              <>
                <Button size="small" variant="outlined" href="/emails?query=in%3Ainbox%20is%3Aunread">
                  Draft reply
                </Button>
                <Button size="small" variant="outlined" href="/tasks">
                  Create task
                </Button>
              </>
            )}
            {isTask && (
              <Button size="small" variant="outlined" href="/assistant?prompt=Create%20a%20task%20from%20this%20context">
                Create task
              </Button>
            )}
            {isMeeting && calendarLink && (
              <Button size="small" variant="outlined" href={calendarLink} target="_blank">
                Google event
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const cleaned = cleanAssistantText(content);
  const rendered = AssistantStructuredCard({ cleaned });
  if (rendered) return rendered;
  const blocks = cleaned.split(/\n{2,}/).filter(Boolean);

  return (
    <Stack spacing={1}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.every((line) => line.startsWith('- '));
        const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));

        if (isBulletList || isNumberedList) {
          return (
            <Stack key={blockIndex} component={isNumberedList ? 'ol' : 'ul'} spacing={0.75} sx={{ pl: 2.5, my: 0 }}>
              {lines.map((line, lineIndex) => (
                <Typography key={lineIndex} component="li" variant="body2" sx={{ lineHeight: 1.65, pl: 0.25 }}>
                  {renderInlineText(line.replace(/^(-|\d+\.)\s+/, ''))}
                </Typography>
              ))}
            </Stack>
          );
        }

        return (
          <Stack key={blockIndex} spacing={0.65}>
            {lines.map((line, lineIndex) => {
              const isSection = /^[A-Z][A-Za-z0-9 ]+:$/.test(line);
              const labelMatch = line.match(/^([A-Z][A-Za-z0-9 ]+):\s+(.+)$/);
              return (
                <Box key={lineIndex}>
                  {isSection ? (
                    <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 850, mt: lineIndex === 0 ? 0 : 0.5 }}>
                      {line.replace(/:$/, '')}
                    </Typography>
                  ) : labelMatch ? (
                    <Typography variant="body2" sx={{ lineHeight: 1.65 }}>
                      <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{labelMatch[1]}: </Box>
                      {renderInlineText(labelMatch[2])}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ lineHeight: 1.65 }}>
                      {renderInlineText(line)}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function AssistantPage() {
  const [searchParams] = useSearchParams();
  const { activeSpaceId, activeSpace, isCombined } = useSpace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(6);
  const recognitionRef = useRef<any>(null);
  const nativeSpeechListenersRef = useRef<PluginListenerHandle[]>([]);
  const dictationBaseRef = useRef('');
  const sendingRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  async function loadConversations() {
    setHistoryLoading(true);
    try {
      const history = await getAssistantConversations();
      setConversations(history);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (isNative) {
      let mounted = true;

      SpeechRecognition.available()
        .then(({ available }) => {
          if (!mounted) return;
          setSpeechSupported(available);
          setSpeechMessage(available ? 'Tap the mic to start dictation.' : 'Voice input is not available on this device.');
        })
        .catch(() => {
          if (!mounted) return;
          setSpeechSupported(false);
          setSpeechMessage('Voice input is not available on this device.');
        });

      return () => {
        mounted = false;
        nativeSpeechListenersRef.current.forEach((listener) => listener.remove());
        nativeSpeechListenersRef.current = [];
        SpeechRecognition.stop().catch(() => undefined);
      };
    }

    const BrowserSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setSpeechSupported(false);
      setSpeechMessage('Voice input is not supported by this browser. Use Chrome or Edge on localhost/HTTPS.');
      return;
    }

    setSpeechSupported(true);
    setSpeechMessage('Tap the mic to start dictation.');
    const recognition = new BrowserSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError('');
      setSpeechMessage('Listening... speak now.');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setInput([dictationBaseRef.current, transcript].filter(Boolean).join(' '));
    };

    recognition.onend = () => {
      setListening(false);
      setSpeechMessage('Tap the mic again to continue dictation.');
    };

    recognition.onnomatch = () => {
      setError('Voice input did not recognize any speech. Please try again.');
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        setSpeechMessage('Microphone permission is blocked.');
        setError('Voice input needs microphone permission. Allow microphone access for this app in Android settings, then try again.');
        return;
      }
      setSpeechMessage('Voice input stopped.');
      setError(`Voice input error: ${event.error ?? 'Speech recognition failed.'}`);
    };

    recognitionRef.current = recognition;
  }, [isNative]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) setInput(prompt);
  }, [searchParams]);

  async function openConversation(id: string) {
    setError('');
    const conversation = await getAssistantConversation(id);
    setConversationId(conversation.id);
    setMessages(conversation.messages.map((message) => ({ role: message.role, content: message.content })));
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setInput('');
    setError('');
  }

  async function send() {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const prompt = input;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: prompt }]);
    setLoading(true);
    try {
      const response = await chat(prompt, conversationId, activeSpaceId);
      setConversationId(response.conversation?.id);
      setMessages((current) => [...current, { role: 'assistant', content: typeof response.result === 'string' ? response.result : JSON.stringify(response.result, null, 2) }]);
      loadConversations();
    } catch (caught) {
      const axiosError = caught as AxiosError<{ error?: { message?: string } }>;
      const message = axiosError.response?.data?.error?.message ?? axiosError.message ?? 'Assistant request failed.';
      setMessages((current) => [...current, { role: 'assistant', content: `I could not complete that request yet.\n\n${message}` }]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  async function requestNativeSpeechAccess() {
    const current = await SpeechRecognition.checkPermissions().catch(() => ({ speechRecognition: 'prompt' }));
    if (current.speechRecognition === 'granted') return true;

    const requested = await SpeechRecognition.requestPermissions().catch(() => ({ speechRecognition: 'denied' }));
    if (requested.speechRecognition === 'granted') return true;

    setSpeechMessage('Microphone permission is blocked.');
    setError('Voice input needs microphone permission. Open Android app settings, allow Microphone, then reopen the app.');
    return false;
  }

  async function startNativeListening() {
    const allowed = await requestNativeSpeechAccess();
    if (!allowed) return;

    const availability = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!availability.available) {
      setError('Speech recognition is not available on this device. Install or enable Google Speech Services, then try again.');
      setSpeechMessage('Speech recognition is unavailable.');
      return;
    }

    nativeSpeechListenersRef.current.forEach((listener) => listener.remove());
    nativeSpeechListenersRef.current = [];
    dictationBaseRef.current = input.trim();
    setError('');
    setSpeechMessage('Listening... speak now.');
    setListening(true);

    const partialListener = await SpeechRecognition.addListener('partialResults', (event) => {
      const transcript = event.accumulatedText ?? event.matches?.[0] ?? event.accumulated ?? '';
      setInput([dictationBaseRef.current, transcript.trim()].filter(Boolean).join(' '));
    });
    const stateListener = await SpeechRecognition.addListener('listeningState', (event) => {
      if (event.status === 'started' || event.state === 'started') {
        setListening(true);
        setSpeechMessage('Listening... speak now.');
      }
      if (event.status === 'stopped' || event.state === 'stopped') {
        setListening(false);
        setSpeechMessage('Tap the mic again to continue dictation.');
      }
    });
    const errorListener = await SpeechRecognition.addListener('error', (event) => {
      setListening(false);
      setSpeechMessage('Voice input stopped.');
      setError(event.message || `Voice input error: ${event.code}`);
    });
    nativeSpeechListenersRef.current = [partialListener, stateListener, errorListener];

    try {
      const result = await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 3,
        partialResults: true,
        popup: false,
        prompt: 'Speak to AI Executive Assistant'
      });
      const transcript = result.matches?.[0]?.trim();
      if (transcript) setInput([dictationBaseRef.current, transcript].filter(Boolean).join(' '));
    } catch (error) {
      setListening(false);
      setSpeechMessage('Voice input stopped.');
      setError(error instanceof Error ? error.message : 'Native voice input could not start.');
    }
  }

  async function stopNativeListening() {
    setListening(false);
    setSpeechMessage('Voice input stopped.');
    await SpeechRecognition.forceStop({ timeout: 1200 }).catch(() => SpeechRecognition.stop().catch(() => undefined));
  }

  async function requestBrowserMicrophoneAccess() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setSpeechMessage('Microphone permission is blocked.');
      setError('Voice input needs microphone permission. Allow microphone access for this app in Android settings, then try again.');
      return false;
    }
  }

  async function toggleListening() {
    if (isNative) {
      if (listening) {
        await stopNativeListening();
        return;
      }
      await startNativeListening();
      return;
    }

    if (!recognitionRef.current) {
      setError('Voice input is not available in this browser.');
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      return;
    }

    setError('');
    dictationBaseRef.current = input.trim();
    const allowed = await requestBrowserMicrophoneAccess();
    if (!allowed) return;
    try {
      recognitionRef.current.start();
    } catch (startError) {
      setListening(false);
      setError(`Voice input failed to start: ${String(startError)}`);
    }
  }

  const promptShortcuts = [
    'Summarize my unread priority emails',
    'What meetings are coming up?',
    'Create a task to follow up tomorrow'
  ];
  const visibleConversations = conversations.slice(0, visibleHistoryCount);

  return (
    <>
      <Grid container spacing={{ xs: 1.25, md: 2.25 }}>
        <Grid item xs={12} md={3.3} lg={2.8} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card className="premium-panel" sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={startNewChat}>New Chat</Button>
                <Box>
                  <Typography variant="h6">History</Typography>
                  <Typography variant="body2" color="text.secondary">{historyLoading ? 'Loading chats...' : `${conversations.length} saved chats`}</Typography>
                </Box>
                <Stack className="scroll-thin" divider={<Divider flexItem />} spacing={0} sx={{ maxHeight: { md: 560 }, overflowY: 'auto', pr: 0.5 }}>
                  {visibleConversations.map((conversation) => (
                    <Box
                      key={conversation.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openConversation(conversation.id)}
                      onKeyDown={(event) => { if (event.key === 'Enter') openConversation(conversation.id); }}
                      sx={{
                        cursor: 'pointer',
                        py: 1.25,
                        px: 1,
                        borderRadius: 2,
                        bgcolor: conversationId === conversation.id ? 'action.selected' : 'transparent',
                        transition: 'background 160ms ease, transform 160ms ease',
                        '&:hover': { bgcolor: 'action.hover', transform: { sm: 'translateX(3px)' } }
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 750 }} noWrap>{conversation.title || 'New conversation'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(conversation.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Typography>
                    </Box>
                  ))}
                  {!historyLoading && conversations.length === 0 && (
                    <Alert severity="info">Your saved chats will appear here.</Alert>
                  )}
                  {visibleHistoryCount < conversations.length && (
                    <Button size="small" variant="outlined" onClick={() => setVisibleHistoryCount((count) => count + 6)} sx={{ mt: 1 }}>
                      Load older chats
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8.5} lg={9}>
          <Card className="premium-panel" sx={{ overflow: 'hidden', borderRadius: { xs: 2, md: 2 }, boxShadow: { xs: 'none', md: undefined } }}>
            <CardContent sx={{ p: { xs: 1, sm: 1.75, md: 2.25 } }}>
          <Stack spacing={{ xs: 1.1, sm: 1.35 }} sx={{ minHeight: { xs: 'calc(100vh - 154px)', md: 620 } }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.15}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ width: { xs: 38, sm: 46 }, height: { xs: 38, sm: 46 }, bgcolor: 'primary.main', boxShadow: '0 12px 26px rgba(37, 87, 214, 0.24)' }}><SmartToyIcon /></Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, lineHeight: 1.15 }}>Workspace Copilot</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isCombined ? 'Using every connected space.' : `Using ${activeSpace?.email ?? 'selected space'}.`}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                <Chip size="small" icon={<AutoAwesomeIcon />} label={conversationId ? 'Conversation saved' : 'New chat'} color={conversationId ? 'success' : 'default'} variant="outlined" />
                <Chip size="small" label={isCombined ? 'Combined workspace' : activeSpace?.email ?? 'Selected space'} color={isCombined ? 'default' : 'primary'} variant={isCombined ? 'outlined' : 'filled'} />
              </Stack>
            </Stack>
            {messages.length === 0 && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {promptShortcuts.map((prompt) => (
                  <Button
                    key={prompt}
                    size="small"
                    variant="outlined"
                    onClick={() => setInput(prompt)}
                    sx={{ bgcolor: 'background.paper', minHeight: 34 }}
                  >
                    {prompt}
                  </Button>
                ))}
              </Stack>
            )}
            <Box className="scroll-thin assistant-chat-window" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25, p: { xs: 1, sm: 1.6 }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.68)' : 'rgba(243, 247, 252, 0.8)', minHeight: { xs: 300, sm: 340 }, maxHeight: { xs: 'none', md: 620 }, overflowY: 'auto' }}>
              {messages.length === 0 && (
                <Box sx={{ my: 'auto', textAlign: 'center', mx: 'auto', maxWidth: 430, py: { xs: 3.5, sm: 6 } }}>
                  <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', height: 46, mx: 'auto', mb: 1.35, width: 46 }}><AutoAwesomeIcon /></Avatar>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.32rem' }, lineHeight: 1.18 }}>What should we move forward?</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.65, fontSize: { xs: '0.88rem', sm: '0.98rem' } }}>Ask for unread priorities, a meeting plan, or a task breakdown.</Typography>
                </Box>
              )}
              {messages.map((message, index) => (
                <Box key={index} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: { xs: '94%', md: '76%' }, bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary', p: { xs: 1.25, sm: 1.5 }, borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', border: message.role === 'assistant' ? '1px solid' : 0, borderColor: 'divider', whiteSpace: message.role === 'user' ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere', boxShadow: message.role === 'assistant' ? '0 10px 24px rgba(0, 0, 0, 0.1)' : '0 10px 24px rgba(37, 87, 214, 0.18)', animation: 'page-enter 220ms ease both' }}>
                  {message.role === 'assistant' ? <AssistantMessageContent content={message.content} /> : <Typography variant="body2">{message.content}</Typography>}
                </Box>
              ))}
              {loading && (
                <Box sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1.25, boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)' }}>
                  <span className="thinking-dots" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                  </span>
                </Box>
              )}
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              alignItems="stretch"
              sx={{
                position: 'sticky',
                bottom: 0,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17,26,44,0.94)' : 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(12px)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: { xs: 0.85, sm: 1.1 }
              }}
            >
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={isCombined ? 'Ask across all spaces...' : `Ask inside ${activeSpace?.email ?? 'this space'}`}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                helperText={speechMessage}
                sx={{ '& .MuiOutlinedInput-root': { alignItems: 'flex-start' }, '& textarea': { lineHeight: 1.45 } }}
              />
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
                <Tooltip title={speechSupported ? (listening ? 'Stop voice input' : 'Start voice input') : 'Voice input not supported'}>
                  <span>
                    <IconButton
                      color={listening ? 'primary' : 'default'}
                      onClick={toggleListening}
                      disabled={!speechSupported}
                      aria-label="Toggle voice input"
                      sx={{ width: 48, height: 48 }}
                    >
                      <MicIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button disabled={loading || !input.trim()} variant="contained" endIcon={<SendIcon />} onClick={send} sx={{ flex: { xs: 1, sm: 'initial' }, minHeight: 48 }}>Send</Button>
              </Stack>
            </Stack>
          </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

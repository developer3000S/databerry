import { AgentModelName, Message, MessageFrom } from '@prisma/client';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AIMessage, BaseMessage, HumanMessage } from 'langchain/schema';

import { ChatResponse } from '@app/types/dtos';

import { ModelConfig } from './config';

export type ChatProps = {
  prompt: string;
  stream?: any;
  temperature?: number;
  modelName?: AgentModelName;
  history?: Message[];
  abortController?: any;
  initialMessages?: BaseMessage[] | undefined;
};

const chat = async ({
  prompt,
  stream,
  temperature,
  history,
  initialMessages = [],
  modelName = AgentModelName.gpt_3_5_turbo,
  abortController,
}: ChatProps) => {
  const _modelName = ModelConfig[modelName]?.name;

  const model = new ChatOpenAI({
    modelName: _modelName,
    temperature: temperature || 0,
    streaming: Boolean(stream),
    callbacks: [
      {
        handleLLMNewToken: stream,
      },
    ],
  });

  if (process.env.APP_ENV === 'test') {
    model.call = async (props: any) => {
      const res = {
        text: 'Hello world',
      } as any;

      if (stream) {
        stream(res.text);
      }

      return res;
    };
  }

  const prevMessages = (history || [])?.map((each) => {
    if (each.from === MessageFrom.human) {
      return new HumanMessage(each.text);
    }
    return new AIMessage(each.text);
  });

  const messages = [
    ...initialMessages,
    ...prevMessages,
    new HumanMessage(prompt),
  ];

  const output = await model.call(messages, {
    signal: abortController?.signal,
  });

  const answer = output?.content.trim?.();

  return {
    answer,
    sources: [] as any,
  } as ChatResponse;
};

export default chat;

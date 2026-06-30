import React from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { gql, useQuery } from "@apollo/client";

const GET_CONVERSATION = gql`
  query GetConversation($id: ID!) {
    conversation(id: $id) {
      id
      externalId
      status
      tiltScore
      grade
      turns {
        id
        role
        content
        flags {
          id
          patternName
          severity
          description
        }
      }
    }
  }
`;

export default function ConversationDetail() {
  const { id } = useParams();

  const { data, loading, error } = useQuery(GET_CONVERSATION, {
    variables: { id },
    skip: !id,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent-500" />
      </div>
    );
  }

  if (error || !data?.conversation) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Conversation not found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          This conversation may have been deleted or does not exist.
        </p>
        <Link
          to="/conversations"
          className="inline-flex items-center text-sm font-medium text-accent-600 hover:text-accent-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to conversations
        </Link>
      </div>
    );
  }

  const conv = data.conversation;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          to="/conversations"
          className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to conversations
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Conversation {conv.externalId || conv.id.slice(0, 8)}
          </h1>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                TiltScore
              </div>
              {conv.tiltScore != null ? (
                <div
                  className={`text-2xl font-bold ${conv.tiltScore <= 40 ? "text-green-500" : conv.tiltScore <= 70 ? "text-amber-500" : "text-red-500"}`}
                >
                  {Math.round(conv.tiltScore)}{" "}
                  <span className="text-lg">{conv.grade}</span>
                </div>
              ) : (
                <div className="text-sm font-medium text-slate-400">
                  Pending
                </div>
              )}
            </div>
            <div className="h-10 border-l border-slate-200 dark:border-slate-700"></div>
            <div className="text-right">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Status
              </div>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  conv.status === "COMPLETED"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : conv.status === "FLAGGED"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {conv.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="convo-card p-6 space-y-6">
        {conv.turns.map((turn: any) => {
          const isUser = turn.role.toLowerCase() === "user";
          return (
            <div
              key={turn.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-3xl ${isUser ? "order-1" : "order-2"}`}>
                <div
                  className={`
                  p-4 rounded-2xl text-sm leading-relaxed
                  ${
                    isUser
                      ? "bg-accent-600 text-white rounded-tr-sm"
                      : "bg-slate-100 text-slate-900 dark:bg-navy-800 dark:text-white rounded-tl-sm"
                  }
                `}
                >
                  {turn.content}
                </div>

                {turn.flags && turn.flags.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {turn.flags.map((flag: any) => (
                      <div
                        key={flag.id}
                        className="flex items-start p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg"
                      >
                        <ShieldAlert className="h-5 w-5 text-red-500 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center">
                            <span className="font-semibold text-red-900 dark:text-red-300 text-sm">
                              {flag.patternName}
                            </span>
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400">
                              {flag.severity}
                            </span>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                            {flag.description}
                          </p>
                          <div className="mt-2 flex space-x-3">
                            <button className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                              Acknowledge
                            </button>
                            <button className="text-xs font-medium text-accent-600 hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300 flex items-center">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark
                              False Positive
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {conv.turns.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            No turns recorded for this conversation.
          </p>
        )}
      </div>
    </div>
  );
}

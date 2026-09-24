import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// JSON body parser for any HTTP endpoints
app.use(express.json());

// API health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Setup WebSocket server for Gemini Live Audio-to-Audio streaming
const wss = new WebSocketServer({ server, path: "/api/live" });

const FRIDAY_SYSTEM_INSTRUCTION = `आप FRIDAY नाम की एक अल्ट्रा-फास्ट, पावरफुल और आत्मविश्वासी नेटिव एंड्रॉइड वॉइस एआई असिस्टेंट (Female AI Assistant) हैं। आप Capacitor Native Bridge और Android Accessibility Service के ज़रिए यूज़र के मोबाइल डिवाइस से सीधे जुड़ी हुई हैं।

⚡ तत्काल एक्शन नियम (Instant Zero-Latency Execution):
- जैसे ही यूज़र का कोई भी कमांड सुनाई दे, बिना किसी देरी के तुरंत सही टूल (Tool Call) चलाएं!
- छोटा, प्यारा और आत्मविश्वासी जवाब दें।

1. मोबाइल में इंस्टॉल ऐप्स सीधे खोलना (openApp):
- जब यूज़र कहे "[ऐप] खोलो" (जैसे WhatsApp, YouTube, Camera, File Manager, ZArchiver, Instagram, Spotify, Settings आदि):
  * कभी भी वेब लिंक न खोलें! इसके बजाय सीधे 'openApp' टूल चलाएं:
    - WhatsApp: com.whatsapp
    - YouTube: com.google.android.youtube
    - Camera: com.android.camera
    - ZArchiver: ru.zdevs.zarchiver
    - File Manager / Files: com.google.android.documentsui
    - Instagram: com.instagram.android
    - Settings: com.android.settings
    - Phone / Dialer: com.android.dialer
    - Spotify: com.spotify.music
  * जवाब: "व्हाट्सएप खोल रही हूँ!" / "कैमरा चालू कर दिया है!"

2. यूट्यूब पर डायरेक्ट सर्च और प्ले (executeYouTubeAction):
- जब यूज़र कहे "यूट्यूब पर [गाना/वीडियो] चलाओ" या "यूट्यूब पर सर्च करो [विषय]":
  * तुरंत 'executeYouTubeAction' टूल चलाएं (action: 'search' या 'play', query के साथ)।
  * जवाब: "यूट्यूब पर आपका गाना चला रही हूँ!"

3. व्हाट्सएप मैसेज भेजना (sendWhatsAppMessage):
- जब यूज़र कहे "व्हाट्सएप पर [नंबर/दोस्त] को मैसेज भेजो [संदेश]":
  * तुरंत 'sendWhatsAppMessage' टूल चलाएं।
  * जवाब: "व्हाट्सएप मैसेज तैयार कर दिया है!"

4. फोन कॉल और अलार्म (triggerPhoneCall, setAlarm):
- "कॉल करो [नंबर]": 'triggerPhoneCall' टूल चलाएं।
- "अलार्म लगाओ [समय]": 'setAlarm' टूल चलाएं।

5. Google Chrome में वेब लिंक खोलना (openWebsite):
- जब यूज़र स्पष्ट कहे "क्रोम में खोलो", "वेबसाइट खोलो", या वेब सर्च करने को कहे:
  * तब 'openWebsite' टूल चलाएं (जो सीधे Google Chrome में खुलेगा)।

6. AI पेज पर तुरंत वापस आना (returnToAiPage):
- जब यूज़र कहे "वापस आ जाओ", "AI पेज पर वापस आ जाओ", "वापस चलो", "बैक":
  * तुरंत 'returnToAiPage' टूल चलाएं।
  * जवाब: "वापस आ गई हूँ!"

7. एक्सेसिबिलिटी परमिशन और सिस्टम नेविगेशन:
- 'requestAccessibilityPermission': जब यूज़र ऑटोमेशन परमिशन देने को कहे।
- 'executeSystemAction': 'back', 'home', 'recents', 'notifications' चलाने के लिए।

व्यवहार (Behavior):
- हिंदी/हिंग्लिश में संक्षिप्त, चुलबुली और सटीक बातें करें। लंबे जवाब बिल्कुल न दें।`;

const fridayFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "returnToAiPage",
    description: "IMMEDIATELY closes opened apps/tabs and returns to the AI page. Execute instantly whenever the user says 'वापस आ जाओ', 'AI पेज पर वापस आ जाओ', 'वापस आओ', 'back', 'return', etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Reason for returning to AI page",
        },
      },
    },
  },
  {
    name: "openApp",
    description: "Opens an installed native Android app on the mobile device using Android Package Manager (e.g. WhatsApp, YouTube, Camera, ZArchiver, File Manager, Instagram, Settings, etc.) instead of opening in a browser.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        packageName: {
          type: Type.STRING,
          description: "Android package name (e.g. 'com.whatsapp', 'com.google.android.youtube', 'com.android.camera', 'ru.zdevs.zarchiver', 'com.google.android.documentsui', 'com.instagram.android', 'com.android.settings')",
        },
        appName: {
          type: Type.STRING,
          description: "Friendly name of the application (e.g. 'WhatsApp', 'YouTube', 'Camera', 'ZArchiver', 'File Manager')",
        },
      },
      required: ["packageName"],
    },
  },
  {
    name: "executeYouTubeAction",
    description: "Automated direct actions inside the native YouTube app such as searching for videos or directly playing a specific video/song.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "'search' to search videos, 'play' to play a video ID or direct search query",
          enum: ["search", "play"],
        },
        query: {
          type: Type.STRING,
          description: "Search keywords or title of song/video (e.g. 'Arijit Singh songs', 'Iron Man Friday scene')",
        },
        videoId: {
          type: Type.STRING,
          description: "Optional specific YouTube video ID if known",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "sendWhatsAppMessage",
    description: "Sends a WhatsApp message to a specific phone number or contact via native Android intent or deep link.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: {
          type: Type.STRING,
          description: "Phone number with country code (e.g. '919876543210') or empty to choose contact in WhatsApp",
        },
        message: {
          type: Type.STRING,
          description: "Message text to send",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "triggerPhoneCall",
    description: "Opens the native device phone dialer to call a specific phone number.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: {
          type: Type.STRING,
          description: "The phone number to dial",
        },
      },
      required: ["phoneNumber"],
    },
  },
  {
    name: "setAlarm",
    description: "Sets an alarm on the Android device clock.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        hour: {
          type: Type.NUMBER,
          description: "Hour in 24-hour format (0-23)",
        },
        minutes: {
          type: Type.NUMBER,
          description: "Minutes (0-59)",
        },
        title: {
          type: Type.STRING,
          description: "Label or title for the alarm",
        },
      },
      required: ["hour", "minutes"],
    },
  },
  {
    name: "openCamera",
    description: "Directly opens the device native camera application.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "requestAccessibilityPermission",
    description: "Directs the user to Android Accessibility Settings so they can enable FRIDAY AI for deep system automation, navigation, and gestures.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "executeSystemAction",
    description: "Executes Android system navigation via Friday Accessibility Service (e.g. 'back', 'home', 'recents', 'notifications').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "System action to perform",
          enum: ["back", "home", "recents", "notifications", "quick_settings", "lock_screen"],
        },
      },
      required: ["action"],
    },
  },
  {
    name: "openWebsite",
    description: "Opens a web link or search query specifically in Google Chrome.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The full web URL to open in Chrome (e.g. https://www.google.com/search?q=..., https://en.uptodown.com)",
        },
        label: {
          type: Type.STRING,
          description: "Friendly title for the website",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "turnOffScreen",
    description: "Turns the mobile/application screen completely OFF into a pitch-black OLED sleep mode when user asks to turn off screen (e.g. 'screen off kar do', 'mobile ki screen off karo', 'screen band karo', 'turn off screen'). The voice listener remains active in the dark.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Optional context or reason for turning off screen",
        },
      },
    },
  },
  {
    name: "turnOnScreen",
    description: "Wakes the screen back ON and displays the mobile password/PIN keypad screen so the user can enter their password (e.g. 'screen on kar do', 'screen on karo', 'mobile on karo', 'turn on screen').",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "lockScreen",
    description: "Locks the application screen into a secure OLED stealth lock screen mode with password/PIN pad when the user requests to lock the screen, phone, or mobile (e.g. 'lock screen', 'screen lock karo', 'lock my phone').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Reason or message for locking the screen",
        },
      },
    },
  },
  {
    name: "unlockScreen",
    description: "Unlocks the screen and returns to the active AI HUD when user asks to unlock via voice (e.g. 'unlock screen', 'screen unlock karo').",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "changeAtmosphere",
    description: "Changes the visual futuristic UI atmosphere/theme of Friday's interface.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        theme: {
          type: Type.STRING,
          description: "The theme style",
          enum: [
            "cyberpunk-magenta",
            "hologram-cyan",
            "neon-crimson",
            "matrix-emerald",
            "electric-amber",
            "stealth-violet",
          ],
        },
      },
      required: ["theme"],
    },
  },
  {
    name: "setTimer",
    description: "Sets a live HUD countdown timer in seconds for the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        seconds: {
          type: Type.NUMBER,
          description: "Duration in seconds (e.g. 60 for 1 minute, 300 for 5 minutes)",
        },
        label: {
          type: Type.STRING,
          description: "What the timer is for (e.g. 'Coffee break', 'Focus session')",
        },
      },
      required: ["seconds"],
    },
  },
  {
    name: "getSystemStatus",
    description: "Retrieves current real-world date, local time, and Friday interface telemetry.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "showTeasingHUD",
    description: "Projects a holographic heads-up display card with a witty reaction, tease, or reminder on the screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "Witty HUD message to show",
        },
        mood: {
          type: Type.STRING,
          description: "Mood of the note (e.g. 'smug', 'flirty', 'playful', 'warning')",
        },
      },
      required: ["text"],
    },
  },
];

const FRIDAY_TOOLS = [
  {
    functionDeclarations: fridayFunctionDeclarations,
  },
];

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("[Friday Live] Client connected via WebSocket");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(
      JSON.stringify({
        error: "GEMINI_API_KEY is not set in the server environment.",
      })
    );
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let session: any = null;
  let isClosed = false;

  async function initSession(selectedVoice = "Aoede") {
    try {
      // Primary model: gemini-3.8-live (low latency real-time voice & instant tool actions)
      const targetModel = "gemini-3.8-live";

      session = await ai.live.connect({
        model: targetModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
          systemInstruction: FRIDAY_SYSTEM_INSTRUCTION,
          tools: FRIDAY_TOOLS,
        },
        callbacks: {
          onopen: () => {
            console.log(`[Friday Live] Connected to Gemini model ${targetModel}`);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  status: "connected",
                  model: targetModel,
                  voice: selectedVoice,
                })
              );
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            // Handle audio output from model turn
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      audio: part.inlineData.data,
                    })
                  );
                }
              }
            }

            // Handle user interruption event
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // Handle model turn complete event
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }

            // Handle function call / tool call
            if (message.toolCall) {
              clientWs.send(
                JSON.stringify({
                  toolCall: message.toolCall,
                })
              );
            }
          },
          onerror: (err: any) => {
            console.error("[Friday Live] Gemini Live error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: err?.message || "Gemini Live session error occurred.",
                })
              );
            }
          },
          onclose: (e: any) => {
            console.log("[Friday Live] Gemini Live session closed:", e?.code, e?.reason);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  status: "session_closed",
                  code: e?.code,
                  reason: e?.reason,
                })
              );
            }
          },
        },
      });
    } catch (err: any) {
      console.error("[Friday Live] Failed to connect to Gemini Live:", err);
      // Try fallback to gemini-3.8-live if preview model had an issue
      try {
        console.log("[Friday Live] Attempting fallback to gemini-3.8-live...");
        session = await ai.live.connect({
          model: "gemini-3.8-live",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
            systemInstruction: FRIDAY_SYSTEM_INSTRUCTION,
            tools: FRIDAY_TOOLS,
          },
          callbacks: {
            onopen: () => {
              console.log("[Friday Live] Fallback connected to gemini-3.8-live");
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    status: "connected",
                    model: "gemini-3.8-live",
                    voice: selectedVoice,
                  })
                );
              }
            },
            onmessage: (message: LiveServerMessage) => {
              if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                  }
                }
              }
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
              if (message.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({ turnComplete: true }));
              }
              if (message.toolCall) {
                clientWs.send(JSON.stringify({ toolCall: message.toolCall }));
              }
            },
            onerror: (e: any) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ error: e?.message || "Live session error" }));
              }
            },
            onclose: (e: any) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ status: "session_closed" }));
              }
            },
          },
        });
      } catch (fallbackErr: any) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              error: `Unable to initiate voice session: ${err?.message || fallbackErr?.message}`,
            })
          );
        }
      }
    }
  }

  // Start with Aoede (young, playful, expressive female voice)
  await initSession("Aoede");

  clientWs.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      // 1. Audio streaming from mic (PCM16, 16kHz)
      if (data.audio && session) {
        session.sendRealtimeInput({
          audio: {
            data: data.audio,
            mimeType: "audio/pcm;rate=16000",
          },
        });
        return;
      }

      // 2. Tool response returned from client
      if (data.toolResponse && session) {
        session.sendToolResponse({
          functionResponses: data.toolResponse.functionResponses,
        });
        return;
      }

      // 3. Change voice configuration
      if (data.type === "change_voice" && data.voice) {
        if (session) {
          try {
            session.close();
          } catch {}
        }
        initSession(data.voice);
        return;
      }

      // 4. Ping/pong for latency measurement
      if (data.type === "ping") {
        clientWs.send(JSON.stringify({ type: "pong", clientTimestamp: data.clientTimestamp }));
        return;
      }
    } catch (e) {
      console.error("[Friday Live] Error parsing client message:", e);
    }
  });

  clientWs.on("close", () => {
    console.log("[Friday Live] Client WebSocket closed");
    isClosed = true;
    if (session) {
      try {
        session.close();
      } catch (err) {
        // ignore
      }
    }
  });

  clientWs.on("error", (err) => {
    console.error("[Friday Live] Client WebSocket error:", err);
    isClosed = true;
    if (session) {
      try {
        session.close();
      } catch {}
    }
  });
});

// Vite middleware / static serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Friday AI Assistant server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

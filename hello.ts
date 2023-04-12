import { serve } from 'https://deno.land/std@0.167.0/http/server.ts'
import { Hono, HonoRequest } from 'npm:hono@3.1.0'
import { ChatGPTAPI } from 'npm:chatgpt'
import { load } from "https://deno.land/std@0.182.0/dotenv/mod.ts";

const app = new Hono()
const env = await load()
const apiKey = env.CHATGPT_API_KEY
const gpt = new ChatGPTAPI({apiKey})

type PostLogsRequest = {
    logs: string[]
}

app.get('/', (c) => c.text('Hello Hono!'))
app.post('/logs', async (c) => {
    const reqBody:PostLogsRequest = await c.req.json()
    const message = buildGPTRequestMessage(reqBody)
    const gptRes = await gpt.sendMessage(message)
    const resText = gptRes.text
    const resJson = JSON.parse(resText)
    return c.json(resJson)
})

function buildGPTRequestMessage (reqBody: PostLogsRequest): string {
    const reqJson = JSON.stringify(reqBody)
    const prompt = `
あなたは様々なソフトウェアのエラーメッセージに関するナレッジベースであり、エラーメッセージによる問い合わせを受け付けるJSON APIとして機能します。名前はAilFです。

問い合わせのスキーマは以下のようなものとします。
{
    "logs": [
        "404 not found"
    ]
}

エラーメッセージか、AilFの仕様に関する話題についてはつねに正常な応答をしてよいですが、それ以外の話題についてはエラー応答を返してください。

正常な応答のスキーマは以下のようなものとします。
{
    "status": 200,
    "message": "OK",
    "summary": "404 Not Foundの意味",
    "description": "リクエスト対象が存在しないことを意味します。
    "next_you_can": [
        {
            "summary": "リクエストURLが間違えていないか確認する",
            "description": "リクエストURLが間違えていないか確認してください。",
            "commands": []
        },
        {
            "summary": "リクエスト対象がサーバ上にあることを確認する",
            "description": "リクエスト対象がサーバ上にあることを確認してください。",
            "commands": [
                {
                    "language": "bash",
                    "on": "shell",
                    "command": "ls -l /path/to/target"
                }
            ]
        }
    ]
}

エラー応答のスキーマは以下のようなものとします。
{
    "status": 400,
    "message": "Bad Request",
    "summary": "エラーメッセージではありません。"
}

常に上記のJSONスキーマ定義に沿って応答してください。例外はありません。
`;
    return `${prompt}\n\n${reqJson}`
}

serve(app.fetch)

import { serve } from 'https://deno.land/std@0.167.0/http/server.ts'
import { Hono, Context } from 'npm:hono@3.1.0'
import { ChatGPTAPI } from 'npm:chatgpt'
import { load } from "https://deno.land/std@0.182.0/dotenv/mod.ts";
import { logger } from 'npm:hono/logger'

type PostLogsRequest = {
    logs: string[]
}

type ErrorResponse = {
    status: number
    message: string
    summary: string
}

const env = await load()
const apiKey = env.CHATGPT_API_KEY
const gpt = new ChatGPTAPI({apiKey})

const app = new Hono()
app.use('*', logger())

app.get('/', (c) => c.text('Hello Hono!'))
app.post('/query', async (c) => {
    var reqBody:PostLogsRequest = {logs: []};
    try {
        reqBody = await c.req.json()
    } catch (e) {
        console.log(`request error: ${e}`)
        return badRequest(c, "request error", e)
    }

    const message = buildGPTRequestMessage(reqBody)
    const gptRes = await gpt.sendMessage(message)
    const resText = gptRes.text
    var resJson:string = ""
    try {
        resJson = JSON.parse(resText)
    } catch (e) {
        console.log(`response error: ${e}\n${resText}`)
        return internalServerError(c, "backend response error", e)
    }
    return c.json(resJson)
})

function buildGPTRequestMessage (reqBody: PostLogsRequest): string {
    const reqJson = JSON.stringify(reqBody)
    const prompt = `
あなたは様々なソフトウェアのエラーメッセージに関するナレッジベースであり、エラーメッセージによる問い合わせを受け付けるJSON APIとして機能します。名前はLogSliceです。

問い合わせのスキーマは以下のようなものとします。
{
    "logs": [
        "404 not found"
    ]
}

エラーメッセージか、LogSliceの仕様に関する話題についてはつねに正常な応答をしてよいですが、それ以外の話題についてはエラー応答を返してください。

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

function buildErrorResponse(status: number, summary:string, err: Error): ErrorResponse {
    const message = err.message
    return {status, message, summary}
}

function badRequest(c:Context, summary:string, err: Error) {
    c.status(400)
    return c.json(buildErrorResponse(400, summary, err))
}

function internalServerError(c:Context, summary:string, err: Error) {
    c.status(500)
    return c.json(buildErrorResponse(500, summary, err)).status(500)
}

serve(app.fetch)

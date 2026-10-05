# Whetstone(磨刀石)

基于个人资料(简历、项目文档、学习笔记)的 RAG 面试与学习陪练智能体:整理资料、生成题目、模拟面试、薄弱点复习。LLM 层支持多服务商自由切换(千问、豆包、Kimi、DeepSeek、Ollama 等,国内厂商优先)。

> 详见《Whetstone(磨刀石):个人面试与学习智能体 项目方案.md》。

## 状态

- [ ] P0:LLM 抽象层 + 解析入库 + 带出处问答
- [ ] P1:岗位解析 + 出题 + 前端骨架
- [ ] P2:评分 + 设置页

## 启动(本地)

```bash
# 后端(Python 3.11+,uv 管理)
cd backend
cp .env.example .env.development   # 填入真实 Key
uv sync
uv run uvicorn src.api.main:app --host 127.0.0.1 --port 8000

# 前端
cd frontend
npm install
npm run dev
```

## 安全提示

- API Key 只放本机 `.env.development` / `.env.production`(已被 .gitignore 排除)或系统凭据管理器,不写入任何提交文件。
- 默认后端只监听 `127.0.0.1`。
- 简历等敏感文档默认标 `local_only`,云端调用前需确认。

## License

私有项目,暂未授权分发。

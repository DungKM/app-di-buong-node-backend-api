const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

export const chatWithAI = async (req, res) => {
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: req.body.contents,

        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
          topP: 0.9,

          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
    });

    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Lỗi kết nối Gemini",
    });
  }
};
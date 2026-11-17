import { Request, Response } from 'express'
import { processChatbotMessage } from '../services/chatbotService'

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { message } = req.body
    const userId = (req as any).user?.id
    
    console.log('Chatbot request received:', { message, userId })
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      })
    }
    
    const result = await processChatbotMessage(message, userId)
    
    console.log('Chatbot response:', result)
    
    // Ensure message is not empty
    if (!result.message || result.message.trim() === '') {
      result.message = 'I received your message but couldn\'t generate a response. Please try rephrasing your question or type "help" for assistance.'
    }
    
    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error processing chatbot message:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process message',
      data: {
        message: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
      },
    })
  }
}


// ...existing code...
import { ChatWebSocketService } from './services/chatWebSocketService.js';
import { aiTrainingService } from './services/aiTrainingService.js';
import { unifiedAIService } from './services/unifiedAIService.js';

export class ProductionMCPServer {
  // ...existing properties...
  private chatWebSocketService?: ChatWebSocketService;

  // ...existing code...

  private setupWebSocketServer(): void {
    // ...existing WebSocket setup...

    // Add chat WebSocket service
    this.chatWebSocketService = new ChatWebSocketService(this.wss);

    console.log('✅ Chat WebSocket service initialized');
  }

  private setupExpressRoutes(): void {
    // ...existing routes...

    // Chat API endpoints
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { userId, message, role, sessionId, context } = req.body;
        
        if (!userId || !message || !role) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const response = await unifiedAIService.processChat(userId, message, {
          role,
          sessionId,
          ...context
        });

        res.json(response);
      } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Training data collection endpoint
    this.app.post('/api/training/collect', async (req, res) => {
      try {
        const { userId, userInput, aiResponse, role, context, feedback } = req.body;
        
        await aiTrainingService.collectInteractionData(
          userId,
          userInput,
          aiResponse,
          role,
          context,
          feedback
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Training collection error:', error);
        res.status(500).json({ error: 'Failed to collect training data' });
      }
    });

    // Admin training endpoints
    this.app.post('/api/admin/training/session', async (req, res) => {
      try {
        const { name, description, dataFilter } = req.body;
        const sessionId = await aiTrainingService.createTrainingSession(name, description, dataFilter);
        res.json({ sessionId });
      } catch (error) {
        console.error('Training session error:', error);
        res.status(500).json({ error: 'Failed to create training session' });
      }
    });

    this.app.get('/api/admin/training/insights', async (req, res) => {
      try {
        const insights = await aiTrainingService.generateTrainingInsights();
        res.json(insights);
      } catch (error) {
        console.error('Training insights error:', error);
        res.status(500).json({ error: 'Failed to generate insights' });
      }
    });

    this.app.post('/api/admin/training/optimize-role/:role', async (req, res) => {
      try {
        const { role } = req.params;
        const optimization = await aiTrainingService.optimizeRoleResponses(role);
        res.json(optimization);
      } catch (error) {
        console.error('Role optimization error:', error);
        res.status(500).json({ error: 'Failed to optimize role' });
      }
    });

    this.app.get('/api/admin/patterns/workflow', async (req, res) => {
      try {
        const patterns = await aiTrainingService.analyzeWorkflowPatterns();
        res.json(patterns);
      } catch (error) {
        console.error('Workflow pattern error:', error);
        res.status(500).json({ error: 'Failed to analyze patterns' });
      }
    });

    // Chat statistics endpoint
    this.app.get('/api/chat/stats', (req, res) => {
      if (this.chatWebSocketService) {
        const stats = this.chatWebSocketService.getSessionStats();
        res.json(stats);
      } else {
        res.status(503).json({ error: 'Chat service not available' });
      }
    });

    console.log('✅ Chat and training API endpoints registered');
  }

  // ...existing code...
}
// ...existing code...
# from openerp import models, fields, api
from openerp import models, fields, api
from datetime import datetime
from openerp.addons.checklist.models.utils import prs, fmt, diff


class project(models.Model):
    _inherit = 'project.project'

    #signature = fields.Binary(string="Signature")
    # signee = fields.Text('Name')
    
    
class ProjecTTask(models.Model):
    
    _inherit = 'project.task'

    #   Skip a task
    def task_skip(self):
        skipped = self.env.ref('checklist.project_tt_skipped')
        self.with_context(stage=skipped.id).task_done()
        self.mapped('work_ids').unlink()

    #   Change status of a task to done and start next task
    def task_done(self):
        done, started, _, _ = self._get_checklist_stages()
        vals = {'stage_id': self._context.get('stage', done.id), 'date_end': fmt(datetime.now())}
        self.action_pause()
        self.write(vals)
        if self.next_task:
            self.next_task.start_task(started)
        else:
            print "Task finished"
        return True

    @api.multi
    def _get_cam_images(self):
        for x in self:
            x.cam_images = self.env['ir.attachment'].search([('res_model', '=', 'project.task'), ('res_id', '=', x.id)])

    cam_images = fields.Many2many('ir.attachment', compute='_get_cam_images', string='Images')
    #cam_images = fields.One2many('ir.attachment', 'project_task_id', string='Images')
    #remarks = fields.Text('Remarks')
    
    
class IRAttachment(models.Model):
    
    _inherit = 'ir.attachment'
    
    # project_task_id =  fields.Many2one('project.task', string='Project Task')
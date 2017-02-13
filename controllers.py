# -*- coding: utf-8 -*-
from openerp import http
from datetime import datetime
from openerp.http import request
from openerp import SUPERUSER_ID
from openerp.tools.translate import _
from openerp.addons.website.models.website import slug
from openerp.addons.checklist.models.utils import prs, fmt, diff
import operator


class Checklistfront(http.Controller):

#   List projects and tasks
    @http.route('/checklist/checklist/', auth='user',website=True)
    def index(self, **kw):
        cr, uid, context, pool = request.cr, request.uid, request.context, request.registry
        active = []
        completed= []
        started, unstarted = [http.request.env.ref('checklist.' + st) for st in 'project_tt_started', 'project_tt_unstarted']
        done = http.request.env.ref('project.project_tt_deployment')
        project_ob = http.request.env['project.project']
        projects = project_ob.search([('state', '!=', 'close'), ('rh_job_number', '!=', 0), ('user_id', '=', uid)])
        for project in projects:
            status = 'done'
            task_list = []
            customer = pool['res.partner'].browse(cr, SUPERUSER_ID, project.partner_id.id, context=context)
            tasks_obj = http.request.env['project.task']
            tasks = tasks_obj.search([('project_id', '=', project.id)], order='sequence asc')
            for task in tasks:
                if task.stage_id == started:
                    status = 'started'
                elif task.stage_id == unstarted and status != 'started':
                    status = 'unstarted'
                task.prev = self.previous_task(task)  # check previous task completed
                task_list.append(task)
            is_completed = self.is_tasks_done(project)
            my_dict = {'project': project,'start': project.date_start,'end': project.date, 'tasks': task_list, 'customer': customer, 'status': status, 'all_done' : is_completed}

            if project.state in ['completed','cancelled']:
                completed.append(my_dict)
            elif project.state in ['open', 'draft']:
                active.append(my_dict)

        active_sorted = sorted(active, key=lambda k: k['start'])  # sort active projects by start date
        completed_sorted = sorted(completed, key=lambda k: k['end'], reverse=True)  # sort completed projects by end date

        return http.request.render('checklist_front.projectview', {
            'projects': active_sorted,  # current checklist
            'completed': completed_sorted,  # completed checklist
            'user':  http.request.env.user
        })

#   Task details
    @http.route('/task/<model("project.task"):task>', auth='user', website=True, type='http', method=['POST', 'GET'])
    def load_task_details(self, task):

        Tasks = http.request.env['project.task']
        started, unstarted = [http.request.env.ref('checklist.' + st) for st in 'project_tt_started', 'project_tt_unstarted']
        done = http.request.env.ref('project.project_tt_deployment')
        status = 'unstarted'
        pause = False

        if task.stage_id == started:
            status = 'started'
        elif task.stage_id == done:
            status = 'done'

        if task.stage_id == started and not task.date_end:
            pause = True

        task_sq_no = self.get_task_number(task)
        return http.request.render('checklist_front.taskdetailview', {
            'taskdetails': task,
            'task_sq_no' : task_sq_no,
            'status': status,
            'pause': pause,
            'extra_time': self.show_extra_hours(task.extra_hours)
        })

#   Get task number for a given task
    def get_task_number(self,task):
        project_ob = http.request.env['project.project']
        project = project_ob.browse([task.project_id.id])
        tasks_obj = http.request.env['project.task']
        tasks = tasks_obj.search([('project_id', '=', project.id)], order='sequence asc')

        for idx,tk in enumerate(tasks):
            if tk == task:
                return idx + 1


    def show_extra_hours(self,value):
        hours = 0
        minutes = 0
        if value:
            min = float(value) * 60.0
            hours = float(min)//60.0
            hours = int(hours)
            minutes = float(min)%60.0
            minutes = int(minutes)
        return {'hours': hours,'minutes': minutes}

#   Save task remarks
    @http.route(['/task/remarks'], type='json', auth="user", website=True)
    def save_remarks(self, task_id, remarks,extra_time, **post):
        task_obj = http.request.env['project.task']
        task = task_obj.browse([task_id])
        task.write({'notes': remarks,'extra_hours': extra_time})
        return {'message': _('Details saved'), 'status': 'success'}

#   Get previous task status by next_task field
    def previous_task_by_next_task(self,current_task):
        done = http.request.env.ref('project.project_tt_deployment')
        tasks_obj = http.request.env['project.task']
        tasks = tasks_obj.search([('project_id','=',current_task.project_id.id)])
        for task in tasks:
            if task.next_task.id == current_task.id:
                if task.stage_id == done:
                    return True
                else:
                    return False
            else:
                return True

#   Get previous task status by sequence field
    def previous_task(self, current_task):
        skipped = http.request.env.ref('checklist.project_tt_skipped')
        done = http.request.env.ref('project.project_tt_deployment')
        tasks_obj = http.request.env['project.task']
        tasks = tasks_obj.search(['&',('sequence', '<', current_task.sequence),('project_id','=',current_task.project_id.id)])
        for task in tasks:
            if task.stage_id not in[done,skipped]:
                return False
        return True

#   Change status
    @http.route(['/task/status/'], type='json', auth="user", website=True)
    def change_status(self, task_id, status, notes=None, **post):
        task_obj = http.request.env['project.task']
        task = task_obj.browse([int(task_id)])
        if status == 'start':
            if self.previous_task(task):
                task.action_start()
                return {'message': _('Task started'), 'status': 'start'}
            else:
                return {'message': _('Previous Task Pending'), 'status': 'fail'}

        elif status == 'pause':
            task.action_pause()
            return {'message': _('Task paused'), 'status': 'pause'}
        elif status == 'skip':
            task.action_skip()
            rtn = self.return_array(task)
            rtn['message'] = _('Task skipped.')
            return rtn
        elif status == 'end':
            task.action_done()
            return self.return_array(task)
        return True

    def return_array(self,task):
        if task.next_task:
            finished = False
            next_url = "/task/" + slug(task.next_task)
        else:
            finished = True
            next_url = "/checklist/checklist"
        return {'message': _('Task finished'), 'status': 'end', 'finished': finished, 'redirect': next_url}

#   Show signature page for checklist
    @http.route('/checklist/done/<model("project.project"):project>', auth='user', website=True, type='http',method=['POST', 'GET'])
    def show_signature_page(self, project):
        cr, uid, context, pool = request.cr, request.uid, request.context, request.registry
        customer = pool['res.partner'].browse(cr, SUPERUSER_ID, project.partner_id.id, context=context)
        return http.request.render('checklist_front.checklist_signature', {
            'project': project,
            'customer': customer,
            'user': http.request.env.user
        })

#   Show cancel note page for checklist
    @http.route('/checklist/cancel/<model("project.project"):project>', auth='user', website=True, type='http',method=['POST', 'GET'])
    def show_cancelnote_page(self, project):
        return http.request.render('checklist_front.checklist_cancel', {
            'project': project,
            'user': http.request.env.user
            # 'status': status,
        })

#   Save signature and close checklist.
    @http.route(['/project/sign'], type='json', auth="user", website=True)
    def accept(self, project_id, sign=None, cust_name=None,note=None, **post):
        project_obj = http.request.env['project.project']
        project = project_obj.browse([project_id])
        project.message_post(body=note and 'DONE: ' + note or note)
        completed = self.is_tasks_done(project)  # check is all task are done
        if completed:
            end = fmt(datetime.now())
            attachments = sign and [('signature.png', sign.decode('base64'))] or []
            project.write({'signature': sign,'signee': cust_name})
            project.action_complete()
            return {'message': _('Checklist finished'),'redirect': '/checklist/checklist'}
        return {'message': _('Checklist have unfinished tasks'),'redirect': '/checklist/checklist'}

#   Check all task are done for given project
    def is_tasks_done(self, project):
        started, unstarted = [http.request.env.ref('checklist.' + st) for st in
                                    'project_tt_started', 'project_tt_unstarted']
        skipped = http.request.env.ref('checklist.project_tt_skipped')
        done = http.request.env.ref('project.project_tt_deployment')
        tasks_obj = http.request.env['project.task']
        tasks = tasks_obj.search([('project_id', '=', project.id)])
        for task in tasks:
            if task.stage_id not in [done,skipped]:
                return False
        return True

#   Save cancel note and cancel the checklist
    @http.route(['/project/cancelnote/'], type='json', auth="user", website=True)
    def save_cancel_note(self, project_id, note):
        project_obj = http.request.env['project.project']
        project = project_obj.browse([int(project_id)])
        project.message_post(body='CANCELLED: ' + note)
        end = fmt(datetime.now())
        project.write({'state': 'cancelled','date': end});
        return {'message': _('Checklist canceled'),'redirect': '/checklist/checklist'}

#   Load reset password template
    @http.route(['/checklist/reset_password'], type='http', auth="user", website=True)
    def change_password_template(self, **kw):
        return http.request.render('checklist_front.change_password_checklist', {})
    
#   Save new password
    @http.route(['/checklist/session/change_password'], type='json', auth="user", website=True)
    def change_password(self, fields):
        old_password, new_password,confirm_password = operator.itemgetter('old_pwd', 'new_password','confirm_pwd')(
                dict(map(operator.itemgetter('name', 'value'), fields)))
        if not (old_password.strip() and new_password.strip() and confirm_password.strip()):
            return {'error':_('You cannot leave the password field empty.'),'title': _('Change Password')}
        if new_password != confirm_password:
            return {'error': _('The passwords does not match.'),'title': _('Change Password')}
        try:
            if request.session.model('res.users').change_password(old_password, new_password):
                return {'new_password':new_password}
        except Exception:
            return {'error': _('The old password you provided is incorrect, your password was not changed.'), 'title': _('Change Password')}
        return {'error': _('Error, password not changed !'), 'title': _('Change Password')}
    
#   Save image
    @http.route(['/project/task/images'], type='json', auth="user", website=True)
    def save_task_image(self, task_id, image=None):
        att_ob = http.request.env['ir.attachment']
        res = att_ob.sudo().create({'res_model': 'project.task', 'res_id':int(task_id), 'type': 'binary', 'db_datas': image,'name':'cam_img'})
        return {'att_id': res.id}
    
#   Remove cam image
    @http.route(['/project/task/images/delete'], type='json', auth="user", website=True)
    def remove_task_image(self, image_id):
        res = request.registry['ir.attachment'].unlink(request.cr, request.uid, [int(image_id)], context=request.context)
        return res

#   Create Extra Task
    @http.route(['/task/create/'], type='json', auth="user", website=True)
    def create_task(self, project_id, title, description, extra_hours):
        task_obj = http.request.env['project.task']
        sequence = self.get_task_sequence(project_id)
        task = task_obj.create({
            'name': title,
            'user_id': request.uid,
            'project_id': project_id,
            'description': description,
            'sequence': sequence,
            # 'extra_hours': "1:30"
        })
        task.extra_hours = extra_hours
        task._show_buttons()
        task._next_task()
        task.action_done() # Close Task
        return {'message': _('Task Created'),'taskname': task.name,'url':'/task/'+slug(task)}

#   Get sequence number for a given task
    def get_task_sequence(self, project_id):
        tasks_obj = http.request.env['project.task']
        tasks = tasks_obj.search([('project_id', '=', int(project_id))], order='sequence desc' ,limit=1)
        return tasks.sequence + 1
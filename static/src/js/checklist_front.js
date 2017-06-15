$(function(){
    console.log("checklist front script");
    // Show/hide project details
    $(document).on('click','.title-text',function(e){
        $('.title-text').removeClass('open');
        $(this).addClass('open');
        var target_id = $(this).data('checklist');
        $('.checklist-body').slideUp();
        if($(target_id).css('display') == 'none'){
            $(target_id).slideDown();
        }else{
            $(target_id).slideUp();
            $(this).removeClass('open');
        }
    });

    // Save remark when focus out from textarea
    $(document).on('focusout','#remarks',function(){
        saveRemarks();
    });

    // Save remark when save button is clicked
    $(document).on('click','#remarksave',function(){
        saveRemarks();
    });

    // Save remarks for task
    function saveRemarks(){
        var remarks = $.trim($('#remarks').val());
        var hours = $.trim($('#taskestimate_hr').val());
        var minute = $.trim($('#taskestimate_min').val());
        var extra = extra_time(hours,minute);
        var task_id = $("#task_id").val();
            openerp.jsonRpc("/task/remarks", 'call', {
            'task_id': parseInt(task_id),
            'remarks': remarks,
            'extra_time': extra
        }).then(function (data) {
            toast(data.message);
        });
    }

    // Status changes for task
    $(document).on('click','.status-btn',function(){
        var task_id = $("#task_id").val();
        var status = $(this).data('status');
        var remarks = $.trim($('#remarks').val());
        if(status == 'skip' && remarks == ""){
            toast("Add skip details.");
            return false;
        }
       openerp.jsonRpc("/task/status/", 'call', {
            'task_id': task_id,
            'status': status,
            'notes' : remarks,
        }).then(function (data) {
            if(data.status){
                switch(data.status){
                    case 'start':
                        var pause_btn = create_action_buttons('pause','Pause','pause','btn-warning','pause-task');
                        var end_btn = create_action_buttons('end','Done','check','btn-success pull-right','task-done');
                        var skip_btn = create_action_buttons('skip','Skip','step-forward','btn-success','skip-task');
                        var na_btn = create_action_buttons('na','N/A','step-forward','btn-success','na-task');
                        $('.task-action-btns').html(pause_btn+skip_btn+na_btn+end_btn);
                        break;
                    case 'pause':
                         var start_btn = create_action_buttons('start','Resume','play','btn-success','start-task');
                         var skip_btn = create_action_buttons('skip','Skip','step-forward','btn-success','skip-task');
                         var na_btn = create_action_buttons('na','N/A','step-forward','btn-success','na-task');
                         $('.task-action-btns').html(start_btn+skip_btn+na_btn);
                        break;
                    case 'end':
                        $('.task-action-btns').html("");
                        if(data.finished){
                            toast("Checklist finished.");
                        }
                        window.location = data.redirect;
                        break;
                    case 'fail':
                        toast(data.message);
                        break;
                }
            }
        });
    });

     /*############################toast############################*/
     function toast(msg,timeout){
         timeout = typeof timeout !== 'undefined' ? timeout : 3000;
         $('#toast').html(msg);
         $('#toast').addClass('show');
         setTimeout(remove_toast, timeout);
     }

     function remove_toast(){
        $('#toast').html("");
        $('#toast').removeClass('show');
     }
     /*############################toast############################*/

    // Task action button html
    function create_action_buttons(action,label,icon,btn_type,id){
        return '<button id="'+id+'" class="btn '+btn_type+' '+action+'-btn status-btn"  data-status="'+action+'">'+label+' <i class="fa fa-'+icon+'" aria-hidden="true"></i></button>';
    }

    // Capture image
    $(document).on('change','.image-capture',function(){
        if(check_connection()){ // check for wifi connection
            readURL(this);
        }else{
            toast("Please use mobile device with wifi connection to upload images");
        }
    });

    // Show gallery
    $(document).on('click','.show-gal',function(){
        var target = $(this).data('gallery');
        $(target).slideToggle();
    });

    // Show image captured image
    function readURLold(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                var image_obj = e.target.result;
                var task_id = $("#task_id").val();               
                var img = image_obj.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                openerp.jsonRpc("/project/task/images", 'call', {
                    'task_id' : task_id,
                    'image' : img,
                }).then(function (data) {
                    if(data.att_id){
                        var htm = create_cam_image_block(image_obj,data.att_id);
                        $('#thumbnails').append(htm).slideDown();
                    }
                });
            };
            reader.readAsDataURL(input.files[0]);
            return input.files[0];
        }
    }

    // Show image captured image
    function readURL(input) {
        if (input.files && input.files[0]) {
            reSizeImage(input);
        }
    }

    // Resize captured image and upload to server
    function reSizeImage(input){
        var filesToUpload = input.files;
        var file = filesToUpload[0];
        var img = document.createElement("img");
        var reader = new FileReader();
        reader.onload = function(e) {
            $("#loader-wrapper").removeClass('hidden');
            img.src = e.target.result;
            img.onload = function () {
                var canvas = document.createElement("canvas");
                //var canvas = $("<canvas>", {"id":"testing"})[0];
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                var MAX_WIDTH = 800;
                var MAX_HEIGHT = 600;

                var width = img.width;
                var height = img.height;

                ratio = Math.min( MAX_WIDTH / width, MAX_HEIGHT/ height );
                ratio = ratio.toFixed(2);

                width = ratio * width;
                height = ratio * height;

                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                var imageData = grayScale(ctx,img);
                // overwrite original image
                ctx.putImageData(imageData, 0, 0);

                var dataurl = canvas.toDataURL("image/png");
                var img_data = dataurl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                var task_id = $("#task_id").val();
                openerp.jsonRpc("/project/task/images", 'call', {
                    'task_id' : task_id,
                    'image' : img_data,
                }).then(function (data) {
                    if(data.att_id){
                        var htm = create_cam_image_block(dataurl,data.att_id);
                        $('#thumbnails').append(htm);
                        $("#loader-wrapper").addClass('hidden');
                    }
                });
            }
        }
        reader.readAsDataURL(file);

    }

// change image to gray scale image
    function grayScale(ctx,img){
     var imageData = ctx.getImageData(0, 0, img.width, img.height);
        var data = imageData.data;

        for(var i = 0; i < data.length; i += 4) {
            var brightness =  0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2]; // EQ-1
            //  var brightness = ( (0.3 * data[i]) + (0.59 * data[i + 1]) + (0.11 * data[i + 2]) ); // EQ-2
            //  var brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2]; // EQ-3

            // red
            data[i] = brightness;
            // green
            data[i + 1] = brightness;
            // blue
            data[i + 2] = brightness;
        }
        return imageData;
    }


    // Remove cam image
    $(document).on('click','.remove-img',function(){
        if(confirm("Confirm to remove image")){
            var that = this;
            var image_id = $(that).parents('.cam_img_block').find('.img_att_id').val();
            openerp.jsonRpc("/project/task/images/delete", 'call', {
                        'image_id' : image_id,
                    }).then(function (data) {
                        $(that).parents('.cam_img_block').remove();
                    });
        }
    });

    // Cam image block html
    function create_cam_image_block(image_obj,att_id){
        var index = $('.cam_img_block').length;
        var html = '<div class="cam_img_block col-xs-4">';
        html += '<div class="thumbnail"><i class="fa fa-times remove-img"></i>';
        html += '<img class="capture-image" id="capture-img_'+ index +'" src="'+image_obj+'" alt="Capture image" width="100" />';
        html += '<input type="hidden" class="img_att_id" id="image_id_'+index+'" value="'+att_id+'" />';
        html += '</div></div>';
        return html;        
    }
    
    // Password reset
    $(document).on('click','.change_password',function(){
        openerp.jsonRpc("/checklist/session/change_password",'call',{
           'fields': $("form[name=change_password_form]").serializeArray()
      }).done(function(result) {
           if (result.error) {
              toast(result.error)
              return;
           } else {
                toast("success");
                window.location = '/web/login';
//                openerp.webclient.on_logout(); // logout user after sucess password reset
           }
      });
    });

    // Show signature pad
    if($("#signature").length){
        $("#signature").jSignature();
    }
    // Save signature image
    $('form.js_checklist_accept_json').submit(function(ev){
        ev.preventDefault();
        if($("#signature").jSignature('getData', 'native').length != 0){
            var project_id = $('#project_id').val();
            var sign = $("#signature").jSignature("getData",'image');
            var sign_svg = sign && (!sign[1] || $.trim(sign[1]) == "") ? $("#signature").jSignature("getData", "svgbase64") : false;
            var name = $.trim($("#cust_name").val());
            var note = $.trim($("#note").val());
            if(name == ""){
                toast("Customer name field cannot be empty.");
                return false;
            }
            openerp.jsonRpc("/project/sign", 'call', {
                'project_id': parseInt(project_id),
                'sign': sign?JSON.stringify(sign[1]):false,
                'sign_svg': sign_svg?JSON.stringify(sign_svg[1]):false,
                'cust_name': name,
                'note':note,
            }).then(function (data) {
                toast(data.message);
                setTimeout(redirect, 2000,data.redirect);
            });
         }else{
            toast("Invalid Signature.");
            return false;
         }

    });

    function redirect(page){
        window.location = page;
    }
    // Clear signature pad
    $(document).on('click','.sign_clean',function(){
        $("#signature").jSignature('reset');
    });

    // Initialize swipe
    if($(".checklist-item").length){
        $('.drag-item').dragend({
			onSwipeStart : function(){
				var idd = $(this.activeElement).find('.title-text').data('checklist');
				$(idd).hide();
				$(this.activeElement).find('.title-text').removeClass('open');
			},
			afterInitialize:function(){
                 if(window.location.hash) {
                    var curr_checklist = $(this.activeElement).find('.title-text').data('project');
                    var hash = window.location.hash.substring(1); //Puts hash in variable, and removes the # character
                    if(curr_checklist == hash){
                        $(this.activeElement).find('.title-text').click();
                    }
                }
			}
		});
    }

    // Save cancel note and cancel checklist
    $(document).on('click','#savenote-btn',function(ev){
        ev.preventDefault();
        var cancelnote = $('#note').val();
        if($.trim(cancelnote) != ""){
            var project_id = $("#project_id").val();
            openerp.jsonRpc("/project/cancelnote/", 'call', {
                    'project_id' : project_id,
                    'note' : $.trim(cancelnote),
                }).then(function (data) {
                   toast(data.message);
                   window.location = data.redirect;
                });
        }
    });

    // Check whether wifi is on/off
    function check_connection(){
        if (navigator.connection) {
            var type = navigator.connection.type;
            if(type == 'wifi'){
                return true; // using wifi
            }
//            return false; // data connection not allowed
            return true; // remove the restriction
        }else{
            return true; // api not supported
        }
    }
    $(window).load(function(){
        $('#mainloader').fadeOut();
    });

/*Signature Capture*/
    $(document).on('click','form.js_checklist_accept_json .thumbnail',function(){
        $('#signature-modal').modal('show');

    });

    $('#signature-modal').on('show.bs.modal', function (e) {
        $("#signature").resize();
    })

    $(document).on('click','#signature-ok',function(){
        $('#signature-modal').modal('hide');
        var datapair = $("#signature").jSignature("getData", "svgbase64")
        if($("#signature").jSignature('getData', 'native').length){
            $('#signatureimage').attr("src","data:" + datapair[0] + "," + datapair[1]).show();
            $('#signature-pad').hide();
        }else{
            $('#signatureimage').hide();
            $('#signature-pad').show();
        }
    });
/*End Signature*/

// show add new task form
    $(document).on('click','.add_new_task',function(){
        var id = '#add_new_from_' + $(this).attr('id').substr(8);
        $('.add_new_from').addClass('hidden');
        $(id).removeClass('hidden');
    });

    $('.add_new_save').on('click',function(ev){
        ev.preventDefault();
        var that = this;
        var title = $($(that).data('title')).val().trim();
        var desc = $($(that).data('desc')).val().trim();
        var checklist = $(that).parents('.checklist-bar');
        var project_id = $(checklist).find('.project_id').val();
        var hours = $($(that).data('hour')).val().trim()?  $($(that).data('hour')).val().trim() : 0;
        var minute = $($(that).data('minute')).val().trim()? $($(that).data('minute')).val().trim() : 0;
        var extra_hours = extra_time(hours,minute);
        if(title.length != 0 && desc.length != 0 && project_id.length !=0){
            openerp.jsonRpc("/task/create/", 'call', {
                'project_id' : project_id,
                'title' : title,
                'description' : desc,
                'extra_hours': extra_hours
            }).then(function (data) {
                var li = create_task_li(data.taskname,data.url);
                $(checklist).find('.tasklist').append(li);
                $(checklist).find('.checklist-title').removeClass('swipe-indicate');
                $($(that).data('title')).val("");
                $($(that).data('desc')).val("");
                $($(that).data('hour')).val("");
                $($(that).data('minute')).val("");
                $('.add_new_from').addClass('hidden');
//               toast(data.message);
            });

        }else{
            toast("Fill title and description");
        }
    });

     function extra_time(hours,minutes){
        return hours+':'+minutes;
     }
// Create new li in task listing
    function create_task_li(name,url){
        var html = '<li><a href="'+url+'">'+name+'</a></li>';
        return html;
    }


// validating estimated hour for new task
    $(document).on('change','.est_hr',function(){
        $(this).parents('.form-group').removeClass('has-error');
        if($(this).val() > 24 || $(this).val() < 0){
            toast("Enter valid hours");
            $(this).val("");
            $(this).parents('.form-group').addClass('has-error');
        }
    });

// validating estimated minute for new task
    $(document).on('change','.est_min',function(){
     $(this).parents('.form-group').removeClass('has-error');
        if($(this).val() > 60 || $(this).val() < 0){
            toast("Enter valid minutes");
            $(this).val("");
            $(this).parents('.form-group').addClass('has-error');
        }
    });

// opening PDF Document
    if($('.pdf-btn-container').length > 0){

        $(document).on('click','.pdf-btn-container a',function(ev){
            ev.preventDefault();
            var pdfUrl = $(this).attr('href');
            PDFObject.embed(pdfUrl, "#help-pdf");
             $('#pdf-modal').modal('show');
        });

    }
});

$(document).ready(function(){
    // Show customer detail popover
    $('[data-toggle="popover"]').popover({
        trigger: 'click',
        html : 'true'
    }).on('show.bs.popover', function () {
       $('.hov').not(this).popover('hide');
       var name = $(this).data('name') == null? "" : $(this).data('name');
       var street = $(this).data('street') == null? "" : $(this).data('street');
       var phno = $(this).data('phone') == null ? "" : "Phone: <a href=\"tel:"+$(this).data('phone')+"\">"+$(this).data('phone')+"</a>";
       var cont = $(this).data('contact') == null ? "" : "Contact: "+$(this).data('contact');
       var model = $(this).data('model') == null ? "" : "Model: "+$(this).data('model');
       var serial = $(this).data('serial') == null ? "" : "S/N: "+$(this).data('serial');
       var descr = $(this).data('description') == null ? "" : $(this).data('description');
       html = '<div><strong>'+name+'</strong></div><div>'+street+'</div><div>'+cont+'</div><div>'+phno+'</div><div>'
           +model+'</div><div>'+serial+'</div><div>'+descr+'</div>';
       $(this).attr('data-content', html);
    });

    // hide popover when tab is changed
    $('.nav-tabs li a').on('click',function(){
        $('.hov').popover('hide');
    })
});

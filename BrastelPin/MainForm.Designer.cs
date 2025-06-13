namespace BrastelPin
{
    partial class MainForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.label1 = new System.Windows.Forms.Label();
            this.txtAccountCode = new System.Windows.Forms.TextBox();
            this.label2 = new System.Windows.Forms.Label();
            this.txtPinFrom = new System.Windows.Forms.TextBox();
            this.label3 = new System.Windows.Forms.Label();
            this.txtTMProxy = new System.Windows.Forms.TextBox();
            this.label4 = new System.Windows.Forms.Label();
            this.txtPinTo = new System.Windows.Forms.TextBox();
            this.btnStart = new System.Windows.Forms.Button();
            this.btnStop = new System.Windows.Forms.Button();
            this.rtbLog = new System.Windows.Forms.RichTextBox();
            this.label5 = new System.Windows.Forms.Label();
            this.txtOmniloginURL = new System.Windows.Forms.TextBox();
            this.btnDeleteAllProfiles = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(12, 13);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(78, 13);
            this.label1.TabIndex = 0;
            this.label1.Text = "Account Code:";
            // 
            // txtAccountCode
            // 
            this.txtAccountCode.Location = new System.Drawing.Point(99, 9);
            this.txtAccountCode.Name = "txtAccountCode";
            this.txtAccountCode.Size = new System.Drawing.Size(235, 20);
            this.txtAccountCode.TabIndex = 0;
            this.txtAccountCode.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(12, 39);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(54, 13);
            this.label2.TabIndex = 0;
            this.label2.Text = "PIN From:";
            // 
            // txtPinFrom
            // 
            this.txtPinFrom.Location = new System.Drawing.Point(99, 35);
            this.txtPinFrom.Name = "txtPinFrom";
            this.txtPinFrom.Size = new System.Drawing.Size(97, 20);
            this.txtPinFrom.TabIndex = 1;
            this.txtPinFrom.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            this.txtPinFrom.KeyPress += new System.Windows.Forms.KeyPressEventHandler(this.TextBoxPinKeyPress);
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(12, 65);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(52, 13);
            this.label3.TabIndex = 0;
            this.label3.Text = "TMProxy:";
            // 
            // txtTMProxy
            // 
            this.txtTMProxy.Location = new System.Drawing.Point(99, 61);
            this.txtTMProxy.Name = "txtTMProxy";
            this.txtTMProxy.Size = new System.Drawing.Size(235, 20);
            this.txtTMProxy.TabIndex = 3;
            this.txtTMProxy.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(206, 39);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(20, 13);
            this.label4.TabIndex = 0;
            this.label4.Text = "To";
            // 
            // txtPinTo
            // 
            this.txtPinTo.Location = new System.Drawing.Point(239, 35);
            this.txtPinTo.Name = "txtPinTo";
            this.txtPinTo.Size = new System.Drawing.Size(95, 20);
            this.txtPinTo.TabIndex = 2;
            this.txtPinTo.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            this.txtPinTo.KeyPress += new System.Windows.Forms.KeyPressEventHandler(this.TextBoxPinKeyPress);
            // 
            // btnStart
            // 
            this.btnStart.Location = new System.Drawing.Point(340, 9);
            this.btnStart.Name = "btnStart";
            this.btnStart.Size = new System.Drawing.Size(101, 46);
            this.btnStart.TabIndex = 4;
            this.btnStart.Text = "Start";
            this.btnStart.UseVisualStyleBackColor = true;
            this.btnStart.Click += new System.EventHandler(this.btnStart_Click);
            // 
            // btnStop
            // 
            this.btnStop.Enabled = false;
            this.btnStop.Location = new System.Drawing.Point(340, 61);
            this.btnStop.Name = "btnStop";
            this.btnStop.Size = new System.Drawing.Size(101, 46);
            this.btnStop.TabIndex = 5;
            this.btnStop.Text = "Stop";
            this.btnStop.UseVisualStyleBackColor = true;
            // 
            // rtbLog
            // 
            this.rtbLog.Location = new System.Drawing.Point(12, 121);
            this.rtbLog.Name = "rtbLog";
            this.rtbLog.ReadOnly = true;
            this.rtbLog.Size = new System.Drawing.Size(429, 200);
            this.rtbLog.TabIndex = 6;
            this.rtbLog.Text = "";
            this.rtbLog.TextChanged += new System.EventHandler(this.rtbLog_TextChanged);
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(12, 90);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(81, 13);
            this.label5.TabIndex = 0;
            this.label5.Text = "Omnilogin URL:";
            // 
            // txtOmniloginURL
            // 
            this.txtOmniloginURL.Location = new System.Drawing.Point(99, 87);
            this.txtOmniloginURL.Name = "txtOmniloginURL";
            this.txtOmniloginURL.Size = new System.Drawing.Size(235, 20);
            this.txtOmniloginURL.TabIndex = 3;
            this.txtOmniloginURL.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // btnDeleteAllProfiles
            // 
            this.btnDeleteAllProfiles.BackColor = System.Drawing.Color.Red;
            this.btnDeleteAllProfiles.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnDeleteAllProfiles.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(128)));
            this.btnDeleteAllProfiles.Location = new System.Drawing.Point(12, 327);
            this.btnDeleteAllProfiles.Name = "btnDeleteAllProfiles";
            this.btnDeleteAllProfiles.Size = new System.Drawing.Size(429, 23);
            this.btnDeleteAllProfiles.TabIndex = 7;
            this.btnDeleteAllProfiles.Text = "Nhấn để xóa hết profile, để bắt đầu chạy lại từ đầu";
            this.btnDeleteAllProfiles.UseVisualStyleBackColor = false;
            this.btnDeleteAllProfiles.Click += new System.EventHandler(this.btnDeleteAllProfiles_Click);
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(450, 361);
            this.Controls.Add(this.btnDeleteAllProfiles);
            this.Controls.Add(this.rtbLog);
            this.Controls.Add(this.btnStop);
            this.Controls.Add(this.btnStart);
            this.Controls.Add(this.txtOmniloginURL);
            this.Controls.Add(this.label5);
            this.Controls.Add(this.txtTMProxy);
            this.Controls.Add(this.label3);
            this.Controls.Add(this.txtPinTo);
            this.Controls.Add(this.label4);
            this.Controls.Add(this.txtPinFrom);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.txtAccountCode);
            this.Controls.Add(this.label1);
            this.MaximizeBox = false;
            this.Name = "MainForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Brastel Pin";
            this.Load += new System.EventHandler(this.MainForm_Load);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.TextBox txtAccountCode;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.TextBox txtPinFrom;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.TextBox txtTMProxy;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.TextBox txtPinTo;
        private System.Windows.Forms.Button btnStart;
        private System.Windows.Forms.Button btnStop;
        private System.Windows.Forms.RichTextBox rtbLog;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.TextBox txtOmniloginURL;
        private System.Windows.Forms.Button btnDeleteAllProfiles;
    }
}

